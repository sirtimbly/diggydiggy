import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import { createProjectController } from "./project/controller.js";
import "../styles.css";

const root = createRoot(document.getElementById("root"));
// Flush only project commits, so canvas geometry and pointer hit testing see the
// same layout as React. Animation frames paint pixels without rendering React.
const controller = createProjectController((view) => {
  flushSync(() =>
    root.render(<App view={view} actions={controller.actions} />),
  );
});
flushSync(() =>
  root.render(<App view={controller.getView()} actions={controller.actions} />),
);
controller.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    controller.dispose();
    root.unmount();
  });
}
