/** The welcome dialog lives in index.html so it renders without JavaScript. */

export const WELCOME_SEEN = "dotflash:welcome-seen";

export function openWelcome() {
  document.querySelector<HTMLDialogElement>("#welcome")?.showModal();
}
