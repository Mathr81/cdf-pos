import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App.js";
import { requestPersistentStorage } from "./lib/persist.js";

// Demandé une fois au démarrage, sans bloquer le rendu : sans stockage
// persistant, le navigateur peut évincer IndexedDB — et l'outbox avec.
// Le statut obtenu est consultable dans Admin → Remise à zéro.
void requestPersistentStorage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
