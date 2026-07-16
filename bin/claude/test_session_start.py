"""Unit tests for the SessionStart rule-loader hook (`session-start`).

Runs under the stdlib ``unittest`` runner -- no external dependencies:

    python3 -m unittest discover -s bin/claude -p 'test_*.py'

The module under test is loaded by path because its filename (`session-start`)
is not a valid module name. Integration cases drive the hook as a subprocess so
they exercise stdin parsing, stdout JSON, stderr warnings, and exit codes end to
end; parser cases call ``parse_config`` directly.
"""

import importlib.util
from importlib.machinery import SourceFileLoader
import json
import os
import subprocess
import sys
import tempfile
import unittest

HOOK = os.path.join(os.path.dirname(os.path.abspath(__file__)), "session-start")


def _load_module():
    loader = SourceFileLoader("session_start", HOOK)
    spec = importlib.util.spec_from_loader("session_start", loader)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


mod = _load_module()


class ParseConfigTest(unittest.TestCase):
    def test_block_scalar_lists(self):
        cfg = mod.parse_config("rules:\n  - lang-php\n  - fw-laravel\n")
        self.assertEqual(cfg["rules"], ["lang-php", "fw-laravel"])

    def test_inline_scalar_list(self):
        cfg = mod.parse_config("rules: [lang-php, fw-laravel]\n")
        self.assertEqual(cfg["rules"], ["lang-php", "fw-laravel"])

    def test_bare_toplevel_list_is_rules(self):
        cfg = mod.parse_config("- lang-php\n- lang-ts\n")
        self.assertEqual(cfg["rules"], ["lang-php", "lang-ts"])

    def test_mapping_list_imports(self):
        text = (
            "imports:\n"
            "  - owner: server\n"
            "    rule: prdl-data-types\n"
            "  - owner: server\n"
            "    rule: prdl-deployment\n"
        )
        cfg = mod.parse_config(text)
        self.assertEqual(
            cfg["imports"],
            [
                {"owner": "server", "rule": "prdl-data-types"},
                {"owner": "server", "rule": "prdl-deployment"},
            ],
        )

    def test_mapping_list_commands(self):
        text = "commands:\n  - cmd: prdl deploy\n    desc: ship it\n"
        cfg = mod.parse_config(text)
        self.assertEqual(cfg["commands"], [{"cmd": "prdl deploy", "desc": "ship it"}])

    def test_comments_and_blank_lines_ignored(self):
        text = "# top comment\nrules:\n  - lang-php  # inline\n\n  - lang-ts\n"
        cfg = mod.parse_config(text)
        self.assertEqual(cfg["rules"], ["lang-php", "lang-ts"])

    def test_hash_in_value_preserved(self):
        cfg = mod.parse_config("local:\n  - build C# project\n")
        self.assertEqual(cfg["local"], ["build C# project"])

    def test_inner_quotes_preserved(self):
        text = "commands:\n  - cmd: unittest discover -p 'test_*.py'\n    desc: run tests\n"
        cfg = mod.parse_config(text)
        self.assertEqual(cfg["commands"][0]["cmd"], "unittest discover -p 'test_*.py'")

    def test_surrounding_quotes_stripped(self):
        cfg = mod.parse_config("rules:\n  - 'lang-php'\n  - \"lang-ts\"\n")
        self.assertEqual(cfg["rules"], ["lang-php", "lang-ts"])

    def test_unknown_section_ignored(self):
        cfg = mod.parse_config("bogus:\n  - x\nrules:\n  - lang-php\n")
        self.assertEqual(cfg["rules"], ["lang-php"])
        self.assertNotIn("bogus", cfg)

    def test_nested_backlog_block_ignored(self):
        # `backlog:` is skill-consumed and two levels deep -- the parser has no
        # representation for it and must drop it whole, keys and all.
        text = (
            "backlog:\n"
            "  repo: owner/name\n"
            "  plan:\n"
            "    method: local\n"
            "    assignee: claude\n"
            "    dir: .claude/plans\n"
            "  todo:\n"
            "    method: gitea\n"
            "    assignee: claude\n"
            "rules:\n"
            "  - lang-php\n"
        )
        cfg = mod.parse_config(text)
        self.assertNotIn("backlog", cfg)
        self.assertEqual(cfg["rules"], ["lang-php"])
        # Its nested `plan:` / `todo:` keys must not leak into any real section.
        self.assertEqual(cfg["local"], [])
        self.assertEqual(cfg["imports"], [])
        self.assertEqual(cfg["commands"], [])

    def test_backlog_between_sections_corrupts_nothing(self):
        # The riskiest placement: sandwiched between real sections, so a parser
        # that mis-tracked the current key would spill `backlog:` into a neighbour.
        text = (
            "rules:\n"
            "  - lang-php\n"
            "backlog:\n"
            "  repo: owner/name\n"
            "  plan:\n"
            "    method: gitea\n"
            "local:\n"
            "  - .claude/rules/prdl-local.md\n"
            "imports:\n"
            "  - owner: server\n"
            "    rule: prdl-data-types\n"
            "commands:\n"
            "  - cmd: prdl deploy\n"
            "    desc: ship it\n"
        )
        cfg = mod.parse_config(text)
        self.assertEqual(cfg["rules"], ["lang-php"])
        self.assertEqual(cfg["local"], [".claude/rules/prdl-local.md"])
        self.assertEqual(
            cfg["imports"], [{"owner": "server", "rule": "prdl-data-types"}]
        )
        self.assertEqual(cfg["commands"], [{"cmd": "prdl deploy", "desc": "ship it"}])


class HookIntegrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = self.tmp.name
        # Global rule library.
        self.rules_dir = os.path.join(self.root, "rules")
        os.makedirs(self.rules_dir)
        self._write(self.rules_dir, "lang-php.md", "# PHP\n- use composer")
        self._write(self.rules_dir, "fw-laravel.md", "# Laravel\n- use artisan")
        # Group root with a sibling owner repo that owns a shared rule.
        self.group_root = os.path.join(self.root, "group")
        owner_rules = os.path.join(self.group_root, "server", ".claude", "rules")
        os.makedirs(owner_rules)
        self._write(owner_rules, "prdl-data-types.md", "# API contract\n- /api")
        # The consumer repo (a sibling of the owner, under the group root).
        self.repo = os.path.join(self.group_root, "client-web")
        self.claude = os.path.join(self.repo, ".claude")
        os.makedirs(self.claude)

    def tearDown(self):
        self.tmp.cleanup()

    def _write(self, directory, name, content):
        with open(os.path.join(directory, name), "w", encoding="utf-8") as handle:
            handle.write(content)

    def _jarrin(self, content):
        self._write(self.claude, ".jarrin.yml", content)

    def _run(self, cwd=None):
        env = dict(os.environ)
        env["JARRIN_RULES_DIR"] = self.rules_dir
        env["JARRIN_GROUP_ROOT"] = self.group_root
        cwd = cwd or self.repo
        proc = subprocess.run(
            [sys.executable, HOOK],
            input=json.dumps({"cwd": cwd}),
            capture_output=True,
            text=True,
            env=env,
        )
        return proc

    def _context(self, proc):
        self.assertEqual(proc.returncode, 0, proc.stderr)
        self.assertTrue(proc.stdout.strip(), "expected JSON on stdout")
        payload = json.loads(proc.stdout)
        return payload["hookSpecificOutput"]["additionalContext"]

    def test_missing_jarrin_yml_errors(self):
        proc = self._run()  # no .jarrin.yml written
        self.assertEqual(proc.returncode, 1)
        self.assertIn("ERROR", proc.stderr)

    def test_global_rule_loaded(self):
        self._jarrin("rules:\n  - lang-php\n")
        ctx = self._context(self._run())
        self.assertIn("use composer", ctx)

    def test_local_rule_loaded(self):
        local_rules = os.path.join(self.claude, "rules")
        os.makedirs(local_rules)
        self._write(local_rules, "prdl-local.md", "# Local\n- repo-specific rule")
        self._jarrin("local:\n  - .claude/rules/prdl-local.md\n")
        ctx = self._context(self._run())
        self.assertIn("repo-specific rule", ctx)

    def test_imported_rule_loaded(self):
        self._jarrin("imports:\n  - owner: server\n    rule: prdl-data-types\n")
        ctx = self._context(self._run())
        self.assertIn("API contract", ctx)

    def test_all_three_tiers_and_dedup(self):
        local_rules = os.path.join(self.claude, "rules")
        os.makedirs(local_rules)
        self._write(local_rules, "prdl-local.md", "# Local\n- repo-specific rule")
        self._jarrin(
            "rules:\n"
            "  - lang-php\n"
            "  - fw-laravel\n"
            "  - lang-php\n"        # duplicate -> loaded once
            "local:\n"
            "  - .claude/rules/prdl-local.md\n"
            "imports:\n"
            "  - owner: server\n"
            "    rule: prdl-data-types\n"
        )
        ctx = self._context(self._run())
        self.assertIn("use composer", ctx)   # global
        self.assertIn("use artisan", ctx)    # global
        self.assertIn("repo-specific rule", ctx)  # local
        self.assertIn("API contract", ctx)   # import
        # Deduplicated: the PHP rule body appears exactly once.
        self.assertEqual(ctx.count("use composer"), 1)

    def test_missing_rule_warns_but_others_load(self):
        self._jarrin(
            "rules:\n"
            "  - lang-php\n"
            "  - does-not-exist\n"
            "imports:\n"
            "  - owner: nope\n"
            "    rule: absent\n"
        )
        proc = self._run()
        ctx = self._context(proc)
        self.assertIn("use composer", ctx)          # good rule still loads
        self.assertIn("WARNING", proc.stderr)
        self.assertIn("does-not-exist", proc.stderr)
        self.assertIn("nope/absent", proc.stderr)

    def test_commands_rendered(self):
        self._jarrin(
            "rules:\n  - lang-php\n"
            "commands:\n  - cmd: prdl deploy\n    desc: ship it\n"
        )
        ctx = self._context(self._run())
        self.assertIn("## Commands", ctx)
        self.assertIn("| `prdl deploy` | ship it |", ctx)

    def test_start_section_no_longer_rendered(self):
        # `start:` was retired; a stray top-level `start:` is an ignored unknown section.
        self._jarrin("start:\n  - do a thing\nrules:\n  - lang-php\n")
        ctx = self._context(self._run())
        self.assertNotIn("## Start here", ctx)
        self.assertNotIn("do a thing", ctx)
        self.assertIn("use composer", ctx)  # rules still load

    def test_backlog_block_ignored_end_to_end(self):
        self._jarrin(
            "backlog:\n"
            "  repo: owner/name\n"
            "  plan:\n"
            "    method: gitea\n"
            "    assignee: claude\n"
            "  todo:\n"
            "    method: local\n"
            "rules:\n"
            "  - lang-php\n"
        )
        proc = self._run()
        ctx = self._context(proc)
        self.assertIn("use composer", ctx)     # rules still load alongside it
        self.assertNotIn("backlog", ctx)       # nothing from the block is injected
        self.assertNotIn("assignee", ctx)
        self.assertNotIn("WARNING", proc.stderr)  # and it is not mistaken for a rule

    def test_jarrin_claude_md_appended(self):
        self._jarrin("rules:\n  - lang-php\n")
        self._write(self.claude, ".jarrin-claude.md", "PROJECT EXTRA NOTE")
        ctx = self._context(self._run())
        self.assertIn("PROJECT EXTRA NOTE", ctx)

    def test_empty_config_injects_nothing(self):
        self._jarrin("# only a comment, nothing selected\n")
        proc = self._run()
        self.assertEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout.strip(), "")


if __name__ == "__main__":
    unittest.main()
