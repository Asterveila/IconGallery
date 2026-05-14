const WHITE = 0xffffff;

const iconTypeToForm = {
    Cube:    'player',
    Ship:    'ship',
    Ball:    'player_ball',
    UFO:     'bird',
    Wave:    'dart',
    Robot:   'robot',
    Spider:  'spider',
    Swing:   'swing',
    Jetpack: 'jetpack'
};

const complexForms = ['robot', 'spider'];
const yOffsets = { player_ball: -10, bird: 55, spider: 7, robot: 5, swing: 0 };
const UHD_MULTIPLIER = 4;

let complexIdleFrames = {
    robot:  null,
    spider: null
};

function loadRobotAnimations(iconStuffJson) {
    const ra = iconStuffJson?.robotAnimations;
    if (!ra) return;

    for (const form of ['robot', 'spider']) {
        const idleFrameEntries = ra.animations?.[form]?.idle?.frames?.[0];
        if (!idleFrameEntries) continue;

        const tints = ra.info?.[form]?.tints ?? {};

        complexIdleFrames[form] = idleFrameEntries.map((entry, i) => ({
            part: entry.part,
            pos: entry.pos,        
            scale: entry.scale,      
            rotation: entry.rotation,   
            flipped: entry.flipped,
            z: entry.z,
            tint: tints[String(i)] 
        }));
    }
}

// --------------------------------
// helpers
// --------------------------------
function hexToDecimal(hex) {
    return parseInt(String(hex).replace('#', ''), 16);
}

function validNum(val, def) {
    const n = +val;
    return isNaN(n) ? def : n;
}

// --------------------------------
// plist stuff
// --------------------------------
function parsePlist(xmlStr) {
    const doc = new DOMParser().parseFromString(xmlStr, 'text/xml');

    const framesEl = doc.children[0]?.children[0]?.children[1];
    if (!framesEl) throw new Error('parsePlist: could not find frames dict');

    const items        = framesEl.children;
    const positionData = {};
    const dataFrames   = {};

    for (let i = 0; i < items.length; i += 2) {
        const frameName = items[i].textContent;
        const frameData = items[i + 1]?.children;
        if (!frameData) continue;

        let isRotated = false;
        dataFrames[frameName]   = {};
        positionData[frameName] = {};

        for (let n = 0; n < frameData.length; n += 2) {
            const key   = frameData[n].textContent;
            const valEl = frameData[n + 1];
            if (!valEl) continue;

            if (['spriteOffset', 'spriteSize', 'spriteSourceSize'].includes(key)) {
                dataFrames[frameName][key] = parseGdArray(valEl.textContent);
            } else if (key === 'textureRotated') {
                isRotated = valEl.outerHTML.includes('true');
                dataFrames[frameName].textureRotated = isRotated;
            } else if (key === 'textureRect') {
                const halves = valEl.textContent.slice(1, -1).split('},{').map(parseGdArray);
                positionData[frameName].pos  = halves[0];
                positionData[frameName].size = halves[1];
            }
        }

        if (isRotated && dataFrames[frameName].spriteSize && positionData[frameName].size) {
            const ss = dataFrames[frameName].spriteSize;
            const pd = positionData[frameName].size;
            if (ss.join(',') === pd.join(',')) positionData[frameName].size = [...pd].reverse();
        }
    }

    return { pos: positionData, frames: dataFrames };
}

function parseGdArray(str) {
    return str.replace(/[^0-9,\-.]/g, '').split(',').map(Number);
}

// --------------------------------
// layer id ing...?
// how do u abbreviate identifying
// --------------------------------
function identifyFrameLayer(frameName, isComplex) {
    const name = frameName.replace(/\.png$/, '');

    if (isComplex) {
        const m = name.match(/^.+?_0([1-4])(?:_(2|3|extra|glow))?_\d+$/);
        if (m) return { layerType: suffixToLayer(m[2]), partNum: parseInt(m[1]) };
    }

    const m = name.match(/^.+?(?:_(2|3|extra|glow))?_\d+$/);
    if (m) return { layerType: suffixToLayer(m[1]), partNum: null };

    return null;
}

function suffixToLayer(suffix) {
    if (!suffix)            return 'col1';
    if (suffix === '2')     return 'col2';
    if (suffix === '3')     return 'ufo';
    if (suffix === 'extra') return 'extra';
    if (suffix === 'glow')  return 'glow';
    return 'col1';
}

// --------------------------------
// file reading
// --------------------------------
function readFileAsText(file) {
    if (typeof file === 'string') return fetch(file).then(r => r.text());
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = e => res(e.target.result);
        r.onerror = rej;
        r.readAsText(file);
    });
}

function readFileAsDataURL(file) {
    return new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = e => res(e.target.result);
        r.onerror = rej;
        r.readAsDataURL(file);
    });
}

function loadHTMLImage(src) {
    return new Promise((res, rej) => {
        const img = new Image();
        img.onload  = () => res(img);
        img.onerror = rej;
        img.src = src;
    });
}

async function loadPixiTexture(file) {
    const src = (file instanceof File || file instanceof Blob)
        ? await readFileAsDataURL(file)
        : file;

    const img         = await loadHTMLImage(src);
    const baseTexture = PIXI.BaseTexture.from(img);

    if (!baseTexture.valid) {
        await new Promise((res, rej) => {
            baseTexture.on('loaded', res);
            baseTexture.on('error',  rej);
        });
    }

    return new PIXI.Texture(baseTexture);
}

// --------------------------------
// ICON RENDERER MAIN
// --------------------------------
class GdIconRenderer {
    constructor(canvas, width = 200, height = 200) {
        this.width  = width;
        this.height = height;
        this.canvas = canvas;
        this.app    = null;
        this._init();
    }

    _init() {
        if (this.app) {
            try { this.app.destroy(false, { children: true }); } catch {}
            this.app = null;
        }
        this.app = new PIXI.Application({
            view:            this.canvas,
            width:           this.width,
            height:          this.height,
            backgroundAlpha: 0,
            antialias:       false,
            resolution:      1,
            autoDensity:     false,
            autoStart:       false
        });
    }

    destroy() {
        if (this.app) {
            try { this.app.destroy(false, { children: true }); } catch {}
            this.app = null;
        }
    }

    async renderIcon(pngFile, plistFile, meta, options = {}) {
        if (!this.app) this._init();
        this.app.stage.removeChildren();

        const plistText   = await readFileAsText(plistFile);
        const parsed      = parsePlist(plistText);
        const baseTexture = await loadPixiTexture(pngFile);
        const frameMap    = this._sliceSheet(baseTexture, parsed.pos, parsed.frames);

        const colors   = this._resolveColors(meta, options);
        const form     = iconTypeToForm[meta.iconType] || 'player';
        const showGlow = !!options.glow;
        const root     = new PIXI.Container();
        root.sortableChildren = true;

        if (complexForms.includes(form)) {
            this._buildComplex(root, frameMap, form, colors, showGlow);
        } else {
            this._buildSimple(root, frameMap, colors, showGlow);
        }

        root.position.set(this.width / 2, this.height / 2 + (yOffsets[form] || 0) * 0.5);
        this.app.stage.addChild(root);
        this.app.renderer.render(this.app.stage);
    }

    _resolveColors(meta, options) {
        const d = meta.colors?.[0] ?? {};
        return {
            col1: hexToDecimal(options.col1    ?? d.p1   ?? '#afafaf'),
            col2: hexToDecimal(options.col2    ?? d.p2   ?? '#ffffff'),
            glow: hexToDecimal(options.glowCol ?? d.glow ?? '#ffffff')
        };
    }

    _sliceSheet(baseTexture, posData, frameData) {
        const result = {};
        for (const [name, bounds] of Object.entries(posData)) {
            if (!bounds.pos || !bounds.size) continue;
            try {
                result[name] = {
                    texture: new PIXI.Texture(baseTexture,
                        new PIXI.Rectangle(bounds.pos[0], bounds.pos[1], bounds.size[0], bounds.size[1])),
                    offsets: frameData[name] ?? {}
                };
            } catch {  }
        }
        return result;
    }

    // --------------------------------
    // simple icons
    // --------------------------------
    _buildSimple(root, frameMap, colors, showGlow) {
        const layers = {};

        for (const [frameName, fd] of Object.entries(frameMap)) {
            const info = identifyFrameLayer(frameName, false);
            if (!info) continue;

            const sprite = this._makeSprite(fd.texture, fd.offsets);
            switch (info.layerType) {
                case 'col1':  sprite.tint = colors.col1; layers.col1  = sprite; break;
                case 'col2':  sprite.tint = colors.col2; layers.col2  = sprite; break;
                case 'ufo':   sprite.tint = WHITE;        layers.ufo   = sprite; break;
                case 'extra': sprite.tint = WHITE;        layers.extra = sprite; break;
                case 'glow':
                    sprite.tint    = colors.glow;
                    sprite.visible = showGlow || colors.col1 === 0;
                    layers.glow    = sprite;
                    break;
            }
        }

        for (const key of ['glow', 'ufo', 'col2', 'col1', 'extra']) {
            if (layers[key]) root.addChild(layers[key]);
        }
    }

    // --------------------------------
    // complex icons
    // --------------------------------
    _buildComplex(root, frameMap, form, colors, showGlow) {
        const poseEntries = complexIdleFrames[form];

        if (!poseEntries) {
            this._buildComplexFallback(root, frameMap, colors, showGlow);
            return;
        }

        const partFrames = {};
        for (const [frameName, fd] of Object.entries(frameMap)) {
            const info = identifyFrameLayer(frameName, true);
            if (!info || info.partNum === null) continue;
            if (!partFrames[info.partNum]) partFrames[info.partNum] = {};
            partFrames[info.partNum][info.layerType] = fd;
        }

        const glowRoot = new PIXI.Container();
        glowRoot.sortableChildren = true;
        glowRoot.visible = showGlow || colors.col1 === 0;

        for (const entry of poseEntries) {
            const pf = partFrames[entry.part];
            if (!pf) continue;

            const bodyPart = new PIXI.Container();
            bodyPart.zIndex = entry.z;

            const glowPart = new PIXI.Container();
            glowPart.zIndex = entry.z;

            for (const lt of ['col2', 'col1', 'extra']) {
                if (!pf[lt]) continue;
                const s = this._makeSprite(pf[lt].texture, pf[lt].offsets);
                if (lt === 'col1')  s.tint = colors.col1;
                if (lt === 'col2')  s.tint = colors.col2;
                if (lt === 'extra') s.tint = WHITE;
                bodyPart.addChild(s);
            }

            if (entry.tint > 0) {
                const darken = new PIXI.ColorMatrixFilter();
                darken.brightness(0);
                darken.alpha = (255 - entry.tint) / 255;
                bodyPart.filters = [darken];
            }

            if (pf.glow) {
                const gs = this._makeSprite(pf.glow.texture, pf.glow.offsets);
                gs.tint = colors.glow;
                glowPart.addChild(gs);
            }

            this._applyPose(bodyPart, entry);
            this._applyPose(glowPart, entry);
            root.addChild(bodyPart);
            glowRoot.addChild(glowPart);
        }

        root.sortChildren();
        root.addChildAt(glowRoot, 0);
        glowRoot.sortChildren();
    }

    _buildComplexFallback(root, frameMap, colors, showGlow) {
        const headFrames = {};
        for (const [frameName, fd] of Object.entries(frameMap)) {
            const info = identifyFrameLayer(frameName, true);
            if (!info || info.partNum !== 1) continue;
            headFrames[info.layerType] = fd;
        }
        for (const lt of ['glow', 'col2', 'col1', 'extra']) {
            if (!headFrames[lt]) continue;
            const s = this._makeSprite(headFrames[lt].texture, headFrames[lt].offsets);
            if (lt === 'col1') s.tint = colors.col1;
            if (lt === 'col2') s.tint = colors.col2;
            if (lt === 'extra') s.tint = WHITE;
            if (lt === 'glow') {
                s.tint = colors.glow;
                s.visible = showGlow || colors.col1 === 0;
            }
            root.addChild(s);
        }
    }

    // ---- sprite helpers ----
    _makeSprite(texture, offsets) {
        const sprite = new PIXI.Sprite(texture);
        sprite.anchor.set(0.5);
        sprite.position.x = validNum(offsets?.spriteOffset?.[0], 0);
        sprite.position.y = validNum(offsets?.spriteOffset?.[1], 0) * -1;
        if (offsets?.textureRotated) sprite.angle = -90;
        return sprite;
    }

    _applyPose(container, entry) {
        container.position.set(
            entry.pos[0] * UHD_MULTIPLIER,
            entry.pos[1] * -UHD_MULTIPLIER
        );
        container.scale.set(
            entry.scale[0] * (entry.flipped[0] ? -1 : 1),
            entry.scale[1] * (entry.flipped[1] ? -1 : 1)
        );
        container.angle = entry.rotation;
    }

    async getDataURL() {
        this.app.renderer.render(this.app.stage);
        return this.canvas.toDataURL('image/png');
    }
}
