import "./style.css";
import { StudioPage } from "./pages/StudioPage";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app container not found");
}

app.appendChild(StudioPage());
