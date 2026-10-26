import { webBluetoothAvailable } from "@dotflash/printer/web-bluetooth";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { openWelcome, WELCOME_SEEN } from "./welcome";

const welcome = document.getElementById("welcome") as HTMLDialogElement;
if (!webBluetoothAvailable()) welcome.querySelector(".browser-notice")?.removeAttribute("hidden");

// The static markup ships the dialog open. Reopen it as a modal so it traps focus and closes on Escape.
welcome.close();
welcome.addEventListener("close", () => localStorage.setItem(WELCOME_SEEN, "1"));
if (!localStorage.getItem(WELCOME_SEEN)) openWelcome();

createRoot(document.getElementById("root")!).render(<App />);
