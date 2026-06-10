/* Rhythm Outdoors — Platform Manual: shared diagram + lightbox behavior.
   Loaded after the Mermaid CDN script on every guide page. */
(function () {
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: true,
      theme: "base",
      themeVariables: {
        fontFamily: "Segoe UI, system-ui, sans-serif",
        fontSize: "14px",
        primaryColor: "#f6f8fb",
        primaryBorderColor: "#9aa6b8",
        primaryTextColor: "#1a1d24",
        lineColor: "#7c8696",
      },
      flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
    });
  }

  // Click any diagram to open it full-width in a popup.
  function setupLightbox() {
    const box = document.getElementById("lightbox");
    if (!box) return;
    const stage = document.getElementById("lightbox-stage");
    const title = document.getElementById("lightbox-title");

    function close() {
      box.classList.remove("open");
      stage.innerHTML = "";
      document.body.style.overflow = "";
    }
    function open(diagram) {
      const svg = diagram.querySelector("svg");
      if (!svg) return; // diagram not rendered yet
      const cap = diagram.querySelector(".diagram-cap");
      title.textContent = cap ? cap.textContent : "Diagram";
      stage.innerHTML = "";
      stage.appendChild(svg.cloneNode(true));
      box.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    document.querySelectorAll(".diagram").forEach(function (diagram) {
      const tag = document.createElement("span");
      tag.className = "zoom-tag";
      tag.textContent = "⤢ Click to enlarge";
      diagram.appendChild(tag);
      diagram.addEventListener("click", function () { open(diagram); });
    });

    document.getElementById("lightbox-close").addEventListener("click", function (e) {
      e.stopPropagation(); close();
    });
    // Click the backdrop closes; clicking the diagram itself does not.
    box.addEventListener("click", function (e) {
      if (e.target === box || e.target.id === "lightbox-stage") close();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("open")) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupLightbox);
  } else {
    setupLightbox();
  }
})();
