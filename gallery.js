fetch("assets/iconkit-data.json")
    .then((r) => r.json())
    .then(loadRobotAnimations)
    .catch(() => {
        console.warn(
            "assets/iconkit-data.json not found",
        );
    });

function applyDynamicScale() {
    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            navigator.userAgent,
        );

    if (!isMobile) {
        document.body.style.zoom = 0.9;
        return;
    }

    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    if (winHeight > winWidth) {
        let scale = winWidth / 1450;
        document.body.style.zoom = scale;
    } else {
        const baseWidth = 1920 / 0.9;
        const baseHeight = 947 / 0.9;
        let scale = Math.min(winWidth / baseWidth, winHeight / baseHeight);

        if (winWidth <= 900) {
            scale += 0.1;
        }
        document.body.style.zoom = scale;
    }
}
window.addEventListener("resize", applyDynamicScale);
applyDynamicScale();

let allIcons = [];
let filteredIcons = [];
let currentView = "list";
let overrideColors = false;
let showGlow = false;
let activeGamemode = "all";
let downloadCounts = {};
let currentPage = 1;
const iconsPerPage = 10;
let currentRenderToken = 0;
let isBasicPreview = /Android/i.test(navigator.userAgent);
let API_BASE = "";

const activeRenderers = new Map();

/*
document.addEventListener("DOMContentLoaded", () => {
    loadSettings();
    setupControls();
    loadIconRegistry();
});
*/

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch("assets/API_BASE.txt");
        if (res.ok) {
            API_BASE = (await res.text()).trim();
        } else {
            console.warn("Failed to load API_BASE.txt");
        }
    } catch (err) {
        console.error("Error fetching API_BASE.txt:", err);
    }

    loadSettings();
    setupControls();
    loadIconRegistry();
});

function loadSettings() {
    const saved = localStorage.getItem("gdGalleryColors");
    const savedFilename = localStorage.getItem("gdGalleryFilename") || "{iconName}-({iconFilenames})";
    if (saved) {
        const colors = JSON.parse(saved);
        document.getElementById("overrideCol1").value = colors.col1;
        document.getElementById("swatchCol1").style.background = colors.col1;
        document.getElementById("overrideCol2").value = colors.col2;
        document.getElementById("swatchCol2").style.background = colors.col2;
        document.getElementById("overrideGlow").value = colors.glow;
        document.getElementById("swatchGlow").style.background = colors.glow;
    }
    document.getElementById("basicPreviewCheck").checked = isBasicPreview;
    document.getElementById("customFilename").value = savedFilename;
}

function setupControls() {
    document
        .getElementById("btnDismissWarning")
        ?.addEventListener("click", () => {
            document.getElementById("portraitWarning").style.display = "none";
        });

    // search
    document.getElementById("btnOpenSearch").addEventListener("click", () => {
        document.getElementById("searchPopup").classList.add("active");
    });
    document.getElementById("btnCloseSearch").addEventListener("click", () => {
        document.getElementById("searchPopup").classList.remove("active");
    });
    document.getElementById("btnRunSearch").addEventListener("click", () => {
        document.getElementById("searchPopup").classList.remove("active");
        applyFilters();
    });

    // settings
    document.getElementById("btnOpenSettings").addEventListener("click", () => {
        document.getElementById("settingsPopup").classList.add("active");
    });
    document
        .getElementById("btnCloseSettings")
        .addEventListener("click", () => {
            document.getElementById("settingsPopup").classList.remove("active");
        });
    document.getElementById("btnSaveSettings").addEventListener("click", () => {
        const colors = {
            col1: document.getElementById("overrideCol1").value,
            col2: document.getElementById("overrideCol2").value,
            glow: document.getElementById("overrideGlow").value,
        };
        localStorage.setItem("gdGalleryColors", JSON.stringify(colors));
        localStorage.setItem("gdGalleryFilename", fnInput.value);
        document.getElementById("settingsPopup").classList.remove("active");
        if (overrideColors) renderGallery();
    });

    document
        .getElementById("basicPreviewCheck")
        .addEventListener("change", (e) => {
            isBasicPreview = e.target.checked;
            renderGallery();
        });

    // popups
    document.getElementById("btnInfoBasicPreview")
        .addEventListener("click", () => {
            document.getElementById("infoPopup").classList.add("active");
        });
    document.getElementById("btnCloseInfo")
        .addEventListener("click", () => {
        document.getElementById("infoPopup").classList.remove("active");
    });

    document.getElementById('btnInfoFilename')
        .addEventListener('click', () => {
        document.getElementById('filenameInfoPopup').classList.add('active');
    });
    document.getElementById('btnCloseFilenameInfo')
        .addEventListener('click', () => {
        document.getElementById('filenameInfoPopup').classList.remove('active');
    });

    // page controls
    document.getElementById("btnPrevPage").addEventListener("click", () => {
        if (currentPage > 1) {
            currentPage--;
            renderGallery();
        }
    });
    document.getElementById("btnNextPage").addEventListener("click", () => {
        const maxPages = Math.ceil(filteredIcons.length / iconsPerPage);
        if (currentPage < maxPages) {
            currentPage++;
            renderGallery();
        }
    });

    // goto page
    document
        .getElementById("btnOpenPagePopup")
        .addEventListener("click", () => {
            document.getElementById("pagePopup").classList.add("active");
            document.getElementById("pageInput").focus();
        });

    document.getElementById("btnClosePage").addEventListener("click", () => {
        document.getElementById("pagePopup").classList.remove("active");
    });

    document.getElementById("btnRunPage").addEventListener("click", () => {
        const pageNum = parseInt(document.getElementById("pageInput").value);
        const maxPages = Math.ceil(filteredIcons.length / iconsPerPage);

        if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
            currentPage = pageNum;
            renderGallery();
        }

        document.getElementById("pagePopup").classList.remove("active");
        document.getElementById("pageInput").value = ""; // clear input
    });

    // filename input
    const fnInput = document.getElementById("customFilename");
    const fnHigh = document.getElementById("filenameHighlight");
    function updateHighlight() {
        const val = fnInput.value;
        const safeVal = escHtml(val);
        fnHigh.innerHTML = safeVal.replace(/({iconName}|{iconAuthor}|{iconFilenames}|{gamemode}|{format})/g, '<span style="color: #ffee00;">$1</span>');
    }

    fnInput.addEventListener("input", updateHighlight);
    fnInput.addEventListener("scroll", () => fnHigh.scrollLeft = fnInput.scrollLeft);
    updateHighlight();

    document
        .getElementById("authorFilter")
        .addEventListener("change", applyFilters);
    document
        .getElementById("formatFilter")
        .addEventListener("change", applyFilters);
    document
        .getElementById("projectFilter")
        .addEventListener("change", applyFilters);
    document
        .getElementById("orderFilter")
        .addEventListener("change", applyFilters);

    document
        .getElementById("viewGrid")
        .addEventListener("click", () => setView("grid"));
    document
        .getElementById("viewList")
        .addEventListener("click", () => setView("list"));

    document
        .getElementById("overrideColors")
        .addEventListener("change", (e) => {
            overrideColors = e.target.checked;
            renderGallery();
        });

    for (const id of ["overrideCol1", "overrideCol2", "overrideGlow"]) {
        document.getElementById(id).addEventListener("input", (e) => {
            const swatchIds = {
                overrideCol1: "swatchCol1",
                overrideCol2: "swatchCol2",
                overrideGlow: "swatchGlow",
            };
            document.getElementById(swatchIds[id]).style.background =
                e.target.value;
        });
    }

    document.getElementById("showGlow").addEventListener("change", (e) => {
        showGlow = e.target.checked;
        renderGallery();
    });

    document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
            document
                .querySelectorAll(".mode-btn")
                .forEach((b) => b.classList.remove("active"));
            btn.classList.add("active");
            activeGamemode = btn.dataset.mode;
            applyFilters();
        });
    });
}

async function loadIconRegistry() {
    setLoadingState("loading");
    try {
        try {
            const dlRes = await fetch(`${API_BASE}/api/downloads`, {
                headers: {
                    "ngrok-skip-browser-warning": "true",
                },
            });
            if (dlRes.ok) downloadCounts = await dlRes.json();
        } catch (e) {
            console.warn("Could not fetch downloads", e);
        }

        const res = await fetch("icons/registry.json");
        if (!res.ok)
            throw new Error(`registry.json responded with HTTP ${res.status}`);
        const registry = await res.json();

        if (!Array.isArray(registry) || registry.length === 0) {
            setLoadingState("empty");
            return;
        }

        const results = await Promise.allSettled(registry.map(loadGdicon));
        allIcons = results
            .filter((r) => r.status === "fulfilled" && r.value)
            .map((r) => r.value);

        results.forEach((r, i) => {
            if (r.status === "rejected")
                console.warn(`Failed to load ${registry[i]}:`, r.reason);
        });
    } catch (err) {
        console.error("Could not load icon registry:", err);
        setLoadingState("error", err.message);
        return;
    }

    populateAuthorFilter();
    applyFilters();
    setLoadingState("done");
}

async function loadGdicon(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
    const blob = await res.blob();
    return parseGdicon(blob, path);
}

async function parseGdicon(blob, sourcePath = "") {
    const zip = await JSZip.loadAsync(blob);

    const jsonFile = zip.file(/^icon\.json$/i)[0];
    if (!jsonFile) throw new Error("Missing icon.json inside " + sourcePath);
    const meta = JSON.parse(await jsonFile.async("string"));

    const pngEntry = zip.file(/\.png$/i).find((f) => f.name !== "preview.png");
    const plistEntry = zip.file(/\.plist$/i)[0];
    if (!pngEntry || !plistEntry)
        throw new Error("Missing PNG or PLIST inside " + sourcePath);

    const pngBlob = new File([await pngEntry.async("blob")], pngEntry.name, {
        type: "image/png",
    });
    const plistBlob = new File(
        [await plistEntry.async("blob")],
        plistEntry.name,
        { type: "text/xml" },
    );

    let previewBlob = null;
    const previewEntry = zip.file("preview.png");
    if (previewEntry) {
        previewBlob = new File(
            [await previewEntry.async("blob")],
            "preview.png",
            {
                type: "image/png",
            },
        );
    }

    return {
        id: sourcePath,
        meta,
        pngFile: pngBlob,
        plistFile: plistBlob,
        previewFile: previewBlob,
        sourcePath,
    };
}

// ----------------------------------
// FILTERING
// ----------------------------------
function applyFilters() {
    const search = document
        .getElementById("searchInput")
        .value.trim()
        .toLowerCase();
    const author = document.getElementById("authorFilter").value;
    const format = document.getElementById("formatFilter").value;
    const project = document.getElementById("projectFilter").value;
    const order = document.getElementById("orderFilter").value;

    filteredIcons = allIcons.filter((icon) => {
        const m = icon.meta;
        if (activeGamemode !== "all" && m.iconType !== activeGamemode)
            return false;
        if (author && m.author !== author) return false;
        if (format && m.format !== format) return false;

        if (project === "has_project" && !m.hasProjectFiles) return false;
        if (project === "no_project" && m.hasProjectFiles) return false;

        if (search) {
            const hay = [
                m.iconName,
                m.author,
                m.description,
                ...(m.collabWith || []),
            ]
                .join(" ")
                .toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    filteredIcons.sort((a, b) => {
        switch (order) {
            case "downloads":
                const dlA = downloadCounts[a.id] || 0;
                const dlB = downloadCounts[b.id] || 0;
                return dlB - dlA;
            case "newest": {
                const d1 = new Date(b.meta.creationDate || 0);
                const d2 = new Date(a.meta.creationDate || 0);
                return d1 - d2;
            }
            case "name-asc":
                return a.meta.iconName.localeCompare(b.meta.iconName);
            case "name-desc":
                return b.meta.iconName.localeCompare(a.meta.iconName);
            case "author-asc":
                return a.meta.author.localeCompare(b.meta.author);
            default:
                return 0;
        }
    });
    currentPage = 1;

    renderGallery();
}

function populateAuthorFilter() {
    const sel = document.getElementById("authorFilter");
    const authors = [...new Set(allIcons.map((i) => i.meta.author))].sort();
    sel.innerHTML = '<option value="">All Authors</option>';
    authors.forEach((a) => {
        const opt = document.createElement("option");
        opt.value = opt.textContent = a;
        sel.appendChild(opt);
    });
}

// ----------------------------------
// VIEW TOGGLING
// ----------------------------------
function setView(view) {
    currentView = view;
    document.getElementById("iconGrid").className = "icon-grid view-" + view;
    document
        .getElementById("viewGrid")
        .classList.toggle("active", view === "grid");
    document
        .getElementById("viewList")
        .classList.toggle("active", view === "list");
}

// ----------------------------------
// RENDERING FUNCS
// ----------------------------------
async function renderGallery() {
    const grid = document.getElementById("iconGrid");
    const empty = document.getElementById("emptyState");
    grid.innerHTML = "";

    const totalFiltered = filteredIcons.length;

    if (totalFiltered === 0) {
        empty.style.display = "flow-root";
        document.getElementById("btnPrevPage").style.display = "none";
        document.getElementById("btnNextPage").style.display = "none";
        document.getElementById("statsLabel").textContent =
            `Showing 0 through 0 out of 0`;
        document.getElementById("pageBtnText").textContent = "0";
        return;
    }
    empty.style.display = "none";

    const totalPages = Math.ceil(totalFiltered / iconsPerPage);
    const startIndex = (currentPage - 1) * iconsPerPage;
    const endIndex = Math.min(startIndex + iconsPerPage, totalFiltered);
    const pageIcons = filteredIcons.slice(startIndex, endIndex);

    document.getElementById("statsLabel").textContent =
        `Showing ${startIndex + 1} through ${endIndex} out of ${totalFiltered}`;
    document.getElementById("pageBtnText").textContent = currentPage;
    document.getElementById("btnPrevPage").style.display =
        currentPage > 1 ? "block" : "none";
    document.getElementById("btnNextPage").style.display =
        currentPage < totalPages ? "block" : "none";

    const renderToken = ++currentRenderToken;
    for (const icon of pageIcons) {
        if (renderToken !== currentRenderToken) return;

        const card = buildCard(icon);
        grid.appendChild(card);
        await setupIconImage(icon, card);
        await new Promise((r) => setTimeout(r, 10));
    }
}

function buildCard(icon) {
    const m = icon.meta;
    const card = document.createElement("div");
    card.className = "icon-card";
    card.dataset.iconId = icon.id;

    const collabStr =
        m.isCollab && m.collabWith?.length
            ? `<span class="font-pusab"> & </span><a href="https://gdbrowser.com/u/${m.collabWith[0]}" target="_blank" style="text-decoration: none;" class="font-golden">${m.collabWith.join(", ")}</a>`
            : "";
    const desc = m.description?.trim() || "[No description provided]";

    const typeClass = `tag-${String(m.iconType).toLowerCase().replace(/\s+/g, "-")}`;
    const formatClass = `tag-${String(m.format).toLowerCase().replace(/\s+/g, "-")}`;

    const projectTag = m.hasProjectFiles
        ? `<span class="tag tag-project">Project Files</span>`
        : "";
    const projectBtn = m.hasProjectFiles
        ? `<button class="gd-btn btn-pink font-pusab project-btn" style="font-size: 1.4rem; padding: 6px 6px; margin-top: 10px;">Get Project</button>`
        : "";

    const dls = downloadCounts[icon.id] || 0;

    card.innerHTML = `
        <div class="card-canvas-wrap">
            <div class="loader-placeholder"></div> 
        </div>
        <div class="card-info">
            <p class="card-name font-pusab">${escHtml(m.iconName)}</p>
            <p class="card-author font-pusab">by <a href="https://gdbrowser.com/u/${m.author}" target="_blank" class="font-golden" style="text-decoration: none;">${escHtml(m.author)}</a>${collabStr}</p>
            <p class="card-desc font-helvetica">${escHtml(desc)}</p>
            <div class="card-tags font-tag">
                <span class="tag ${typeClass}">${escHtml(m.iconType)}</span>
                <span class="tag ${formatClass}">${escHtml(m.format)}</span>
                ${projectTag}
                <div class="dl-count-box font-pusab">
                    <img src="assets/downloadsIcon.png" class="dl-icon"> ${dls}
                </div>
            </div>
            <div class="btn-container">
                <button class="gd-btn btn-blue font-pusab download-btn" style="font-size: 1.6rem;">Download</button>
                ${projectBtn}
            </div>
        </div>
    `;

    card.querySelector(".download-btn").addEventListener("click", () =>
        downloadIcon(icon),
    );
    if (m.hasProjectFiles) {
        card.querySelector(".project-btn").addEventListener("click", () =>
            downloadProjectFiles(icon),
        );
    }
    return card;
}

async function setupIconImage(icon, card) {
    const container = card.querySelector(".card-canvas-wrap");

    if (isBasicPreview && icon.previewFile) {
        const imgElement = document.createElement("img");
        imgElement.src = URL.createObjectURL(icon.previewFile);
        imgElement.classList.add("icon-canvas");
        imgElement.style.width = "100%";
        container.innerHTML = "";
        container.appendChild(imgElement);
        return;
    }

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = 200;
    tempCanvas.height = 200;

    const renderer = new GdIconRenderer(tempCanvas, 200);

    try {
        await renderer.renderIcon(
            icon.pngFile,
            icon.plistFile,
            icon.meta,
            getColorOpts(),
        );

        const dataUrl = await renderer.getDataURL();

        const imgElement = document.createElement("img");
        imgElement.src = dataUrl;
        imgElement.classList.add("icon-canvas");
        imgElement.style.width = "100%";

        container.innerHTML = "";
        container.appendChild(imgElement);
    } catch (err) {
        console.warn("Render failed for", icon.meta.iconName, err);
    } finally {
        renderer.destroy();
    }
}

function getColorOpts() {
    const opts = { glow: showGlow };
    if (overrideColors) {
        opts.col1 = document.getElementById("overrideCol1").value;
        opts.col2 = document.getElementById("overrideCol2").value;
        opts.glowCol = document.getElementById("overrideGlow").value;
    }
    return opts;
}
// ----------------------------------
// PORTING SHIT
// ----------------------------------
function parseXMLPlist(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    function parseValue(element) {
        const tagName = element.tagName.toLowerCase();
        switch (tagName) {
            case "string":
                return element.textContent;
            case "integer":
                return parseInt(element.textContent);
            case "real":
                return parseFloat(element.textContent);
            case "true":
                return true;
            case "false":
                return false;
            case "array":
                const array = [];
                for (const child of element.children)
                    array.push(parseValue(child));
                return array;
            case "dict":
                const dict = {};
                const children = Array.from(element.children);
                for (let i = 0; i < children.length; i += 2) {
                    const key = children[i].textContent;
                    const value = parseValue(children[i + 1]);
                    dict[key] = value;
                }
                return dict;
            default:
                return null;
        }
    }
    const plistElement = xmlDoc.querySelector("plist > dict");
    return parseValue(plistElement);
}

function generateXMLPlist(data) {
    function valueToXML(value, indent = 0) {
        const spaces = "\t".repeat(indent);
        if (typeof value === "string")
            return `${spaces}<string>${value}</string>`;
        if (typeof value === "number")
            return Number.isInteger(value)
                ? `${spaces}<integer>${value}</integer>`
                : `${spaces}<real>${value}</real>`;
        if (typeof value === "boolean") return `${spaces}<${value}/>`;
        if (Array.isArray(value)) {
            if (value.length === 0) return `${spaces}<array/>`;
            const items = value
                .map((item) => valueToXML(item, indent + 1))
                .join("\n");
            return `${spaces}<array>\n${items}\n${spaces}</array>`;
        }
        if (typeof value === "object" && value !== null) {
            const entries = Object.entries(value);
            if (entries.length === 0) return `${spaces}<dict/>`;
            const items = entries
                .map(
                    ([k, v]) =>
                        `${spaces}\t<key>${k}</key>\n${valueToXML(v, indent + 1)}`,
                )
                .join("\n");
            return `${spaces}<dict>\n${items}\n${spaces}</dict>`;
        }
        return `${spaces}<string></string>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
${valueToXML(data)}
</plist>`;
}

function parseBracedTuple(s) {
    s = s.trim().slice(1, -1);
    const parts = s.split(",");
    return [parseFloat(parts[0].trim()), parseFloat(parts[1].trim())];
}

function parseTextureRect(s) {
    const inner = s.trim().slice(2, -2);
    const parts = inner.split("},{");
    const xy = parseBracedTuple("{" + parts[0] + "}");
    const wh = parseBracedTuple("{" + parts[1] + "}");
    return [xy[0], xy[1], wh[0], wh[1]];
}

function formatBracedTuple(arr) {
    function fmt(v) {
        const rounded = Math.round(v * 100) / 100;
        return Number.isInteger(rounded)
            ? rounded.toString()
            : rounded.toFixed(2);
    }
    return `{${fmt(arr[0])},${fmt(arr[1])}}`;
}

function formatTextureRect(x, y, w, h) {
    return `{{${Math.round(x)},${Math.round(y)}},{${Math.round(w)},${Math.round(h)}}}`;
}

function packRectangles(frames, gap = 2) {
    const sortedFrames = [...frames].sort(
        (a, b) => b.newSize[1] - a.newSize[1],
    );
    const bins = [];
    const placements = new Map();

    for (const frame of sortedFrames) {
        const [frameW, frameH] = frame.newSize;
        const frameWithGap = frameW + gap;
        const frameHeightWithGap = frameH + gap;
        let placed = false;

        for (const bin of bins) {
            if (bin.width + frameWithGap <= 4096) {
                placements.set(frame, { x: bin.width, y: bin.y });
                bin.width += frameWithGap;
                bin.maxHeight = Math.max(bin.maxHeight, frameH);
                placed = true;
                break;
            }
        }

        if (!placed) {
            const newY =
                bins.length > 0
                    ? Math.max(
                          ...bins.map((bin) => bin.y + bin.maxHeight + gap),
                      )
                    : 0;
            const newBin = {
                x: 0,
                y: newY,
                width: frameWithGap,
                maxHeight: frameH,
            };
            bins.push(newBin);
            placements.set(frame, { x: 0, y: newY });
        }
    }

    const sheetWidth = Math.max(...bins.map((bin) => bin.width)) - gap;
    const sheetHeight =
        bins.length > 0
            ? Math.max(...bins.map((bin) => bin.y + bin.maxHeight))
            : 0;

    return { placements, sheetWidth, sheetHeight };
}

async function portToHD(pngBlob, plistBlob) {
    try {
        const plistText = await plistBlob.text();
        const plistData = parseXMLPlist(plistText);

        const img = new Image();
        const imageUrl = URL.createObjectURL(pngBlob);

        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
        });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const frames = plistData.frames || {};
        const processedFrames = [];

        for (const [frameName, frameData] of Object.entries(frames)) {
            const [x, y, w, h] = parseTextureRect(frameData.textureRect);
            const [spriteW, spriteH] = parseBracedTuple(frameData.spriteSize);
            const [offsetX, offsetY] = parseBracedTuple(
                frameData.spriteOffset || "{0,0}",
            );
            const isRotated = frameData.textureRotated || false;

            let spriteCanvas = document.createElement("canvas");
            let spriteCtx = spriteCanvas.getContext("2d");

            if (isRotated) {
                const cropW = spriteH;
                const cropH = spriteW;

                const tempCanvas = document.createElement("canvas");
                const tempCtx = tempCanvas.getContext("2d");
                tempCanvas.width = cropW;
                tempCanvas.height = cropH;
                tempCtx.drawImage(
                    canvas,
                    x,
                    y,
                    cropW,
                    cropH,
                    0,
                    0,
                    cropW,
                    cropH,
                );

                const rotatedCanvas = document.createElement("canvas");
                const rotatedCtx = rotatedCanvas.getContext("2d");
                rotatedCanvas.width = spriteW;
                rotatedCanvas.height = spriteH;

                rotatedCtx.translate(
                    rotatedCanvas.width / 2,
                    rotatedCanvas.height / 2,
                );
                rotatedCtx.rotate(Math.PI / 2);
                rotatedCtx.drawImage(
                    tempCanvas,
                    -tempCanvas.width / 2,
                    -tempCanvas.height / 2,
                );

                const finalCanvas = document.createElement("canvas");
                const finalCtx = finalCanvas.getContext("2d");
                finalCanvas.width = spriteW;
                finalCanvas.height = spriteH;
                finalCtx.translate(
                    finalCanvas.width / 2,
                    finalCanvas.height / 2,
                );
                finalCtx.rotate(Math.PI);
                finalCtx.drawImage(
                    rotatedCanvas,
                    -rotatedCanvas.width / 2,
                    -rotatedCanvas.height / 2,
                );

                spriteCanvas = finalCanvas;
                spriteCtx = finalCtx;
            } else {
                spriteCanvas.width = spriteW;
                spriteCanvas.height = spriteH;
                spriteCtx.drawImage(
                    canvas,
                    x,
                    y,
                    spriteW,
                    spriteH,
                    0,
                    0,
                    spriteW,
                    spriteH,
                );
            }

            const resizedCanvas = document.createElement("canvas");
            const resizedCtx = resizedCanvas.getContext("2d");
            const newW = Math.max(1, Math.floor(spriteW / 2));
            const newH = Math.max(1, Math.floor(spriteH / 2));
            resizedCanvas.width = newW;
            resizedCanvas.height = newH;

            resizedCtx.imageSmoothingEnabled = true;
            resizedCtx.imageSmoothingQuality = "high";
            resizedCtx.drawImage(spriteCanvas, 0, 0, newW, newH);

            // i just realized this shouldnt be here
            // uhh sorry for now
            // i just straight up stole my own code LMFAO
            // ill tweak ts eventuallyyyyyyyyyyyyyyy
            const preserveOffset =
                frameName && frameName.includes("GJ_table_side_001");
            const newOffset = preserveOffset
                ? [offsetX, offsetY]
                : [offsetX / 2, offsetY / 2];

            processedFrames.push({
                name: frameName,
                canvas: resizedCanvas,
                originalData: frameData,
                newSize: [newW, newH],
                newOffset: newOffset,
            });
        }

        const { placements, sheetWidth, sheetHeight } = packRectangles(
            processedFrames,
            2,
        );

        const newSheet = document.createElement("canvas");
        const newSheetCtx = newSheet.getContext("2d");
        newSheet.width = sheetWidth;
        newSheet.height = sheetHeight;

        const newFrames = {};

        processedFrames.forEach((frame) => {
            const placement = placements.get(frame);
            newSheetCtx.drawImage(frame.canvas, placement.x, placement.y);

            newFrames[frame.name] = {
                aliases: frame.originalData.aliases || [],
                spriteOffset: formatBracedTuple(frame.newOffset),
                spriteSize: formatBracedTuple(frame.newSize),
                spriteSourceSize: formatBracedTuple(frame.newSize),
                textureRect: formatTextureRect(
                    placement.x,
                    placement.y,
                    frame.newSize[0],
                    frame.newSize[1],
                ),
                textureRotated: false,
            };
        });

        const metadata = { ...plistData.metadata };
        metadata.size = formatBracedTuple([sheetWidth, sheetHeight]);

        if (metadata.realTextureFileName) {
            metadata.realTextureFileName = metadata.realTextureFileName.replace(
                "-uhd",
                "-hd",
            );
        }
        if (metadata.textureFileName) {
            metadata.textureFileName = metadata.textureFileName.replace(
                "-uhd",
                "-hd",
            );
        }

        const newPlistData = {
            frames: newFrames,
            metadata: metadata,
        };

        const newPlistXml = generateXMLPlist(newPlistData);
        URL.revokeObjectURL(imageUrl);

        return {
            plist: newPlistXml,
            png: await new Promise((resolve) =>
                newSheet.toBlob(resolve, "image/png"),
            ),
        };
    } catch (error) {
        console.error("Error generating HD port:", error);
        throw error;
    }
}

// ----------------------------------
// ICON & FILES DOWNLOADING
// ----------------------------------
async function downloadIcon(icon) {
    fetch(`${API_BASE}/api/download`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ iconId: icon.id }),
    }).catch((e) => console.warn("Failed to increment download count", e));

    downloadCounts[icon.id] = (downloadCounts[icon.id] || 0) + 1;

    const includeMedium = document.getElementById("includeMediumPorts").checked;
    const meta = icon.meta;
    const iconRealName = icon.pngFile.name
        .replace(/-uhd\.png$/i, "")
        .replace(/\.png$/i, "");
    const template = document.getElementById("customFilename").value || "{iconName}-({iconFilenames})";
    const zip = new JSZip();
    zip.file(icon.pngFile.name, icon.pngFile);
    zip.file(icon.plistFile.name, icon.plistFile);

    let baseName = template
        .replace(/{iconName}/g, meta.iconName.replace(/ /g, "_"))
        .replace(/{iconAuthor}/g, meta.author.replace(/ /g, "_"))
        .replace(/{iconFilenames}/g, iconRealName)
        .replace(/{gamemode}/g, meta.iconType)
        .replace(/{format}/g, meta.format);
    baseName = baseName.replace(/[^a-zA-Z0-9_\-\(\)\[\]\s]/g, "");

    if (includeMedium) {
        try {
            const { png, plist } = await portToHD(icon.pngFile, icon.plistFile);
            zip.file(baseName + "-hd.png", png);
            zip.file(baseName + "-hd.plist", plist);
        } catch (err) {
            console.warn("HD port failed:", err);
        }
    }

    const blob = await zip.generateAsync({ type: "blob" });
    triggerDownload(blob, baseName + ".zip");
}

async function downloadProjectFiles(icon) {
    const baseName = icon.meta.iconName
        .replace(/[^a-zA-Z0-9_\- ]/g, "")
        .replace(/\s+/g, "_");
    try {
        const res = await fetch(icon.id);
        if (!res.ok) throw new Error("Could not fetch icon package.");
        const blob = await res.blob();

        const zip = await JSZip.loadAsync(blob);
        const projZip = zip.file("projectFiles.zip");
        if (!projZip)
            throw new Error("Project files missing from this archive!");

        const projBlob = await projZip.async("blob");
        triggerDownload(projBlob, baseName + "_ProjectFiles.zip");
    } catch (e) {
        console.error("Failed to download project files:", e);
        alert("Failed to extract project files. " + e.message);
    }
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// other shit bro
function setLoadingState(state, errorMsg = "") {
    const loading = document.getElementById("loadingState");
    const empty = document.getElementById("emptyState");

    loading.style.display = state === "loading" ? "flow-root" : "none";

    if (state === "error") {
        empty.style.display = "flow-root";
        empty.innerHTML = `
            <p>⚠ Could not load icons.</p>
            <p style="font-size:0.8rem;margin-top:8px;color:#ff8c8c">${escHtml(errorMsg)}</p>
            <p style="font-size:0.8rem;margin-top:8px">Make sure you are running a local web server (see START_HERE.md).</p>
        `;
    }
}

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
