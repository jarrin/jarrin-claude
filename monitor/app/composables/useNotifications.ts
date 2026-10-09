import type { Notice } from "~/utils/instances";

/**
 * Browser desktop notifications. Permission has to be asked from a click, so the
 * page shows a button until it is granted (or denied for good).
 */
export function useNotifications(onClick: (notice: Notice) => void) {
  const supported = ref(false);
  const permission = ref<NotificationPermission>("default");

  onMounted(() => {
    supported.value = "Notification" in window;
    if (supported.value) permission.value = Notification.permission;
  });

  const enable = async (): Promise<void> => {
    if (!supported.value) return;
    permission.value = await Notification.requestPermission();
  };

  const notify = (notice: Notice): void => {
    if (!supported.value || Notification.permission !== "granted") return;
    const n = new Notification(notice.title, {
      body: notice.body,
      tag: notice.tag,
      requireInteraction: notice.tag.startsWith("question-"),
    });
    n.onclick = () => {
      window.focus();
      onClick(notice);
      n.close();
    };
  };

  return { supported, permission, enable, notify };
}
