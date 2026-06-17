/**
 * BrandBot — framework-agnostic core for the brandable 3D robot mascot.
 *
 * const robot = createBrandbot(container, { gltf: modelJson });
 * robot.set({ primary: '#13294b', eyes: '#7fd4ff', logoText: 'ACME' });
 * robot.spin();
 * robot.dispose();
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const DEFAULTS = {
    gltf: null,
    modelUrl: null,
    trackPointer: 'window',
    shadow: true,
    legs: true,
    orbit: false,
    intro: true,
    camera: { position: [0, 2.95, 5.6], target: [0, 2.95, 0], fov: 34 },
    primary: '#17171c', accent: '#08080a', visor: '#b0b0b8', hands: '#77777e',
    eyes: '#e9f4ff', logoText: '', logoColor: '#ffffff', logoImage: null,
};
export function createBrandbot(container, options = {}) {
    const opts = { ...DEFAULTS, ...options };
    /* ------------------------------------------------------------ renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 1.5), 2)); // supersample 1x displays
    renderer.shadowMap.enabled = opts.shadow;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    // studio reflection environment: softbox strips on black, for the sharp
    // highlight streaks in the chrome face and glossy shell
    const pmrem = new THREE.PMREMGenerator(renderer);
    {
        const env = new THREE.Scene();
        env.background = new THREE.Color(0x000000);
        const strip = (w, h, intensity, x, y, z) => {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color().setScalar(intensity), side: THREE.DoubleSide }));
            m.position.set(x, y, z);
            m.lookAt(0, 1, 0);
            env.add(m);
        };
        strip(7, 7, 12, 0, 9, 2); // overhead softbox — glossy crown highlight
        strip(3, 9, 5, -8, 3, 0.5);
        strip(3, 9, 4, 8, 3, 0);
        strip(1.6, 7, 3.5, -5, 3, -6);
        strip(1.6, 7, 3.5, 6, 3, -6);
        // high blur sigma = soft, natural studio reflections instead of hard streaks;
        // panels sit at the true sides so the face center reflects dark, edges bright
        scene.environment = pmrem.fromScene(env, 0.3).texture;
    }
    const camera = new THREE.PerspectiveCamera(opts.camera.fov, 1, 0.1, 100);
    const camTarget = new THREE.Vector3(opts.camera.target[0], opts.camera.target[1], opts.camera.target[2]);
    const camEnd = new THREE.Vector3(opts.camera.position[0], opts.camera.position[1], opts.camera.position[2]);
    // intro: start zoomed on the FACE, then pull back and down to the full-body
    // framing. The face shrinks and the head rises toward the top of frame as
    // the body is revealed below.
    const introFromPos = new THREE.Vector3(camTarget.x, 3.95, camTarget.z + 1.75);
    const introFromLook = new THREE.Vector3(camTarget.x, 4.05, camTarget.z);
    const _introLook = new THREE.Vector3();
    camera.position.copy(opts.intro ? introFromPos : camEnd);
    camera.lookAt(opts.intro ? introFromLook : camTarget);
    // drag-to-rotate, only when asked (demos). Off by default so the component
    // sits locked in its box and faces forward in real apps.
    let controls = null;
    if (opts.orbit) {
        controls = new OrbitControls(camera, renderer.domElement);
        controls.target.copy(camTarget);
        controls.enableDamping = true;
        controls.enablePan = false;
        controls.minDistance = 3.5;
        controls.maxDistance = 11;
        controls.minPolarAngle = 0.7;
        controls.maxPolarAngle = 1.75;
        controls.enabled = !opts.intro; // handed control after the intro dolly
    }
    // the intro is armed but only *starts* once the model is in (see setupModel),
    // so the face-zoom plays when the robot is actually visible — not during the
    // async load when the canvas is still empty
    const introState = { active: false, t: 0, dur: 2.3 };
    scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3f4a, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3.5, 7, 5);
    key.castShadow = opts.shadow;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -1;
    key.shadow.radius = 6;
    scene.add(key);
    const rimL = new THREE.DirectionalLight(0xffffff, 2.2);
    rimL.position.set(-6, 4, -2);
    scene.add(rimL);
    const rimR = new THREE.DirectionalLight(0xffffff, 1.8);
    rimR.position.set(6, 4, -2.5);
    scene.add(rimR);
    if (opts.shadow) {
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.16 }));
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);
    }
    /* ------------------------------------------------------------ materials */
    // Weave maps are painted in NORMALIZED tones (base→white) and darkened via
    // material.color — so user-chosen colors actually show instead of being
    // multiplied into black by a dark texture.
    function makeCarbonTexture(size = 256, cell = 16, base = '#2c2c2c') {
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const g = c.getContext('2d');
        g.fillStyle = base;
        g.fillRect(0, 0, size, size);
        for (let y = 0; y < size / cell; y++) {
            for (let x = 0; x < size / cell; x++) {
                const horiz = (x + y) % 2 === 0;
                const grad = horiz
                    ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0)
                    : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
                grad.addColorStop(0, base);
                grad.addColorStop(0.5, '#ffffff');
                grad.addColorStop(1, base);
                g.fillStyle = grad;
                g.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
            }
        }
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 8;
        return tex;
    }
    const carbonTex = makeCarbonTexture(256, 16, '#2c2c2c'); // strong weave (arms)
    const carbonTexSubtle = makeCarbonTexture(256, 16, '#6e6e72'); // barely-there weave (torso)
    function boxUV(geometry, scale) {
        if (geometry.userData.boxUV)
            return;
        geometry.userData.boxUV = true;
        const pos = geometry.attributes.position, nor = geometry.attributes.normal;
        const uv = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
            let u, v;
            if (nx >= ny && nx >= nz) {
                u = z;
                v = y;
            }
            else if (ny >= nx && ny >= nz) {
                u = x;
                v = z;
            }
            else {
                u = x;
                v = y;
            }
            uv[i * 2] = u * scale;
            uv[i * 2 + 1] = v * scale;
        }
        geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    }
    const materials = {
        primary: new THREE.MeshPhysicalMaterial({ color: 0x17171c, roughness: 0.52, metalness: 0.25, clearcoat: 0.45, clearcoatRoughness: 0.4, envMapIntensity: 1.0, map: carbonTexSubtle, bumpMap: carbonTexSubtle, bumpScale: 0.25 }),
        primaryPlain: new THREE.MeshPhysicalMaterial({ color: 0x0e0e12, roughness: 0.38, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.25, envMapIntensity: 1.1 }),
        carbon: new THREE.MeshPhysicalMaterial({ color: 0x2e2e36, roughness: 0.5, metalness: 0.25, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 1.0, map: carbonTex, bumpMap: carbonTex, bumpScale: 0.8 }),
        joint: new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.35, metalness: 0.9, envMapIntensity: 1.1 }),
        visor: new THREE.MeshPhysicalMaterial({ color: 0xb0b0b8, roughness: 0.06, metalness: 1.0, envMapIntensity: 1.6 }),
        chrome: new THREE.MeshPhysicalMaterial({ color: 0x77777e, roughness: 0.18, metalness: 1.0, envMapIntensity: 1.1 }),
    };
    /* ------------------------------------------------------ canvas textures */
    const eyeCanvas = document.createElement('canvas');
    eyeCanvas.width = 512;
    eyeCanvas.height = 256;
    const eyeTexture = new THREE.CanvasTexture(eyeCanvas);
    eyeTexture.colorSpace = THREE.SRGBColorSpace;
    let eyeColor = opts.eyes;
    function drawEyes(color, squash = 0) {
        eyeColor = color;
        const g = eyeCanvas.getContext('2d');
        g.clearRect(0, 0, 512, 256);
        g.fillStyle = color;
        // squash 0..1 collapses the dot rows (blink)
        for (const cx of [102, 410]) {
            for (let row = 0; row < 5; row++) {
                for (let col = 0; col < 7; col++) {
                    const x = cx + (col - 3) * 16, y = 126 + (row - 2) * 16 * (1 - squash);
                    if (((col - 3) / 3.4) ** 2 + ((row - 2) / 2.6) ** 2 > 1)
                        continue;
                    g.beginPath();
                    g.arc(x, y, 6.5 * (1 - squash * 0.35), 0, Math.PI * 2);
                    g.fill();
                }
            }
        }
        eyeTexture.needsUpdate = true;
    }
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 512;
    logoCanvas.height = 512;
    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    logoTexture.anisotropy = 8;
    function drawLogoText(text, color) {
        const g = logoCanvas.getContext('2d');
        g.clearRect(0, 0, 512, 512);
        if (text) {
            g.fillStyle = color;
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            const words = String(text).toUpperCase().split(/\s+/).slice(0, 3);
            let size = 110;
            do {
                g.font = `800 ${size}px -apple-system, Inter, sans-serif`;
                size -= 6;
            } while (words.some(w => g.measureText(w).width > 440) && size > 30);
            const lh = size * 1.25, y0 = 256 - (words.length - 1) * lh / 2;
            words.forEach((w, i) => g.fillText(w, 256, y0 + i * lh));
        }
        logoTexture.needsUpdate = true;
    }
    function drawLogoImage(img) {
        const g = logoCanvas.getContext('2d');
        g.clearRect(0, 0, 512, 512);
        const s = Math.min(440 / img.width, 440 / img.height);
        const w = img.width * s, h = img.height * s;
        g.drawImage(img, 256 - w / 2, 256 - h / 2, w, h);
        logoTexture.needsUpdate = true;
    }
    /* ----------------------------------------------------------- model rig */
    const robot = new THREE.Group();
    scene.add(robot);
    let headPivot = null;
    let waistPivot = null;
    let bottomNode = null;
    const armRigs = [];
    function addDecal(target, position, size, material) {
        target.updateWorldMatrix(true, false);
        const geo = new DecalGeometry(target, position, new THREE.Euler(), size);
        geo.applyMatrix4(new THREE.Matrix4().copy(target.matrixWorld).invert());
        const m = new THREE.Mesh(geo, material);
        m.renderOrder = 1;
        target.add(m);
        return m;
    }
    // `getPoint` is evaluated only after world matrices are refreshed —
    // a precomputed point can be measured against stale matrices.
    function pivotAt(node, getPoint) {
        const parent = node.parent;
        parent.updateWorldMatrix(true, true);
        const point = getPoint();
        const pivot = new THREE.Group();
        parent.add(pivot);
        pivot.position.copy(parent.worldToLocal(point.clone()));
        pivot.updateWorldMatrix(true, false);
        pivot.attach(node);
        return pivot;
    }
    // Pivot whose local Y axis is aligned to a world-space direction, so
    // rotation.y twists `node` axially (e.g. forearm pronation). Outer group
    // carries the alignment; the returned inner group is safe to animate.
    function axialPivotAt(node, getPoint, getAxis) {
        const parent = node.parent;
        parent.updateWorldMatrix(true, true);
        const point = getPoint();
        const axis = getAxis();
        const align = new THREE.Group();
        parent.add(align);
        align.position.copy(parent.worldToLocal(point.clone()));
        const inv = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const axisLocal = axis.clone().transformDirection(inv);
        align.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisLocal);
        align.updateWorldMatrix(true, false);
        const pivot = new THREE.Group();
        align.add(pivot);
        pivot.updateWorldMatrix(true, false);
        pivot.attach(node);
        return pivot;
    }
    const bboxOf = (n) => new THREE.Box3().setFromObject(n);
    const centerOf = (n) => bboxOf(n).getCenter(new THREE.Vector3());
    const topOf = (n) => { const b = bboxOf(n); return new THREE.Vector3((b.min.x + b.max.x) / 2, b.max.y, (b.min.z + b.max.z) / 2); };
    const bottomOf = (n) => { const b = bboxOf(n); return new THREE.Vector3((b.min.x + b.max.x) / 2, b.min.y, (b.min.z + b.max.z) / 2); };
    // One arm is a mirrored instance, which flips the sense of some rotations;
    // probe each axis once and store the sign that moves the hand as intended.
    function calibrateRig(rig) {
        const center = (setup) => {
            rig.shoulder.rotation.set(0, 0, 0);
            if (rig.elbow)
                rig.elbow.rotation.set(0, 0, 0);
            if (setup)
                setup();
            rig.shoulder.updateWorldMatrix(true, true);
            const c = bboxOf(rig.handRef).getCenter(new THREE.Vector3());
            rig.shoulder.rotation.set(0, 0, 0);
            if (rig.elbow)
                rig.elbow.rotation.set(0, 0, 0);
            rig.shoulder.updateWorldMatrix(true, true);
            return c;
        };
        const base = center();
        const out = center(() => { rig.shoulder.rotation.z = 0.4; });
        rig.outSign = (out.x - base.x) * rig.side > 0 ? 1 : -1;
        const raise = center(() => { rig.shoulder.rotation.x = -0.4; });
        rig.raiseSign = (raise.z - base.z) + (raise.y - base.y) > 0 ? -1 : 1;
        if (rig.elbow) {
            const bend = center(() => { rig.elbow.rotation.x = -0.6; });
            rig.bendSign = (bend.z - base.z) + (bend.y - base.y) > 0 ? -1 : 1;
            const bent = center(() => { rig.elbow.rotation.x = rig.bendSign * 0.9; });
            const splay = center(() => { rig.elbow.rotation.x = rig.bendSign * 0.9; rig.elbow.rotation.y = 0.4; });
            rig.splaySign = (splay.x - bent.x) * rig.side > 0 ? 1 : -1;
        }
    }
    function setupModel(gltf) {
        const bot = gltf.scene.getObjectByName('Bot') || gltf.scene;
        const junk = [];
        gltf.scene.traverse(o => { if (o.isLight || o.isCamera)
            junk.push(o); });
        junk.forEach(o => o.removeFromParent());
        let box = new THREE.Box3().setFromObject(bot);
        bot.scale.multiplyScalar(4.6 / box.getSize(new THREE.Vector3()).y);
        robot.add(bot);
        box = new THREE.Box3().setFromObject(bot);
        const c = box.getCenter(new THREE.Vector3());
        bot.position.x -= c.x;
        bot.position.z -= c.z;
        bot.position.y -= box.min.y;
        bot.traverse(o => {
            const m = o;
            if (!m.isMesh)
                return;
            m.castShadow = true;
            m.material = /Cylinder|Cube/.test(m.name) ? materials.joint : materials.primaryPlain;
        });
        const headMesh = bot.getObjectByName('Head_2'); // loader swaps spaces for underscores
        if (headMesh)
            headMesh.material = materials.visor;
        const bodyMesh = bot.getObjectByName('Body');
        if (bodyMesh) {
            boxUV(bodyMesh.geometry, 0.035);
            bodyMesh.material = materials.primary;
        }
        const headNode = bot.getObjectByName('Head') || headMesh;
        if (headNode)
            headPivot = pivotAt(headNode, () => centerOf(headNode));
        const topPart = bot.getObjectByName('Top_part');
        if (topPart)
            waistPivot = pivotAt(topPart, () => bottomOf(topPart));
        bottomNode = bot.getObjectByName('Bottom') || null; // legs + pelvis
        if (bottomNode)
            bottomNode.visible = state.legs;
        // two arm assemblies; the loader dedupes the second's names with suffixes
        const armRoots = [];
        bot.traverse(o => { if (/^Hand_LEFT(_\d+)?$/.test(o.name))
            armRoots.push(o); });
        armRoots.forEach(root => {
            let arm, forearm, elbowNode;
            root.traverse(o => {
                if (!arm && /^arm(_\d+)?$/.test(o.name))
                    arm = o;
                if (!forearm && /^forearm(_\d+)?$/.test(o.name))
                    forearm = o;
                if (!elbowNode && /^elbow(_\d+)?$/.test(o.name))
                    elbowNode = o;
            });
            if (!arm)
                return;
            let shoulderJoint = null;
            arm.traverse(o => { if (!shoulderJoint && /^Cube_2(_\d+)?$/.test(o.name))
                shoulderJoint = o; });
            const elbowRing = elbowNode && elbowNode.children.find(ch => /^Group(_\d+)?$/.test(ch.name));
            const armNode = arm;
            const shoulder = pivotAt(armNode, () => shoulderJoint ? centerOf(shoulderJoint) : topOf(armNode));
            const forearmNode = forearm;
            const elbow = forearmNode ? pivotAt(forearmNode, () => elbowRing ? centerOf(elbowRing) : topOf(forearmNode)) : null;
            const side = Math.sign(shoulder.getWorldPosition(new THREE.Vector3()).x) || 1;
            // pronation pivot: twist the whole forearm (hand included) around its
            // own long axis — palm rotation with nothing to detach
            let handMesh = null;
            (forearmNode || root).traverse(o => { if (!handMesh && o.isMesh && /^Hand(_\d+)?$/.test(o.name))
                handMesh = o; });
            let twist = null;
            if (forearmNode && handMesh) {
                const hand = handMesh;
                const elbowPoint = () => elbowRing ? centerOf(elbowRing) : topOf(forearmNode);
                twist = axialPivotAt(forearmNode, elbowPoint, () => centerOf(hand).sub(elbowPoint()).normalize());
            }
            const rig = { shoulder, elbow, twist, handRef: forearmNode || armNode, side, raiseSign: -1, outSign: 1, bendSign: -1, splaySign: 1 };
            calibrateRig(rig);
            armRigs.push(rig);
            root.traverse(o => {
                const m = o;
                if (!m.isMesh)
                    return;
                if (/^Hand(_\d+)?$/.test(m.name)) {
                    m.material = materials.chrome;
                    return;
                }
                if (/^(Rectangle_3|Ellipse_3)(_\d+)?$/.test(m.name)) {
                    m.material = materials.joint;
                    return;
                }
                boxUV(m.geometry, 0.045);
                m.material = materials.carbon;
            });
        });
        if (headMesh) {
            const hb = bboxOf(headMesh), hc = hb.getCenter(new THREE.Vector3()), hs = hb.getSize(new THREE.Vector3());
            addDecal(headMesh, new THREE.Vector3(hc.x, hc.y + hs.y * 0.06, hb.max.z), new THREE.Vector3(hs.x * 0.80, hs.x * 0.40, hs.z * 0.45), new THREE.MeshBasicMaterial({ map: eyeTexture, transparent: true, toneMapped: false,
                polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
        }
        if (bodyMesh) {
            const bb = bboxOf(bodyMesh), bc = bb.getCenter(new THREE.Vector3()), bs = bb.getSize(new THREE.Vector3());
            addDecal(bodyMesh, new THREE.Vector3(bc.x, bc.y + bs.y * 0.12, bb.max.z), new THREE.Vector3(bs.x * 0.55, bs.x * 0.55, bs.z * 0.5), new THREE.MeshStandardMaterial({ map: logoTexture, transparent: true, roughness: 0.5, metalness: 0.1,
                polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
        }
        // model is in — now play the zoom-in entrance
        if (opts.intro) {
            introState.active = true;
            introState.t = 0;
        }
    }
    const loader = new GLTFLoader();
    if (opts.gltf)
        loader.parse(JSON.stringify(opts.gltf), '', setupModel, (err) => console.error('BrandBot: parse failed', err));
    else if (opts.modelUrl)
        loader.load(opts.modelUrl, setupModel, undefined, (err) => console.error('BrandBot: load failed', err));
    else
        console.error('BrandBot: pass `gltf` (JSON) or `modelUrl` in options');
    /* -------------------------------------------------------------- pointer */
    // store raw client coords; the head-aim maps them into the canvas's own
    // normalized space each frame, so "cursor on the face" means looking
    // straight ahead regardless of where the canvas sits on the page
    const pointer = { clientX: 0, clientY: 0, active: false, last: 0 };
    function onPointerMove(e) {
        pointer.clientX = e.clientX;
        pointer.clientY = e.clientY;
        pointer.active = true;
        pointer.last = Date.now();
    }
    function onLeave() { pointer.active = false; }
    const pointerTarget = opts.trackPointer === 'element' ? container : window;
    if (opts.trackPointer) {
        pointerTarget.addEventListener('pointermove', onPointerMove);
        document.addEventListener('mouseleave', onLeave);
    }
    /* ------------------------------------------------------------ animation */
    const GESTURES = [
        { raise: 0.03, out: 0.20, bend: 0.65, splay: 0.15, twist: 0 }, // shrug (home)
        { raise: 0.04, out: 0.22, bend: 0.78, splay: 0.12, twist: 0.15 }, // shrug, hands high
        { raise: 0.02, out: 0.26, bend: 0.50, splay: 0.22, twist: 0.35 }, // open wide
        { raise: -0.08, out: 0.02, bend: -0.60, splay: 0.02, twist: 0.25 }, // arms fully down at the sides
        { raise: 0, out: 0.30, bend: 0.05, splay: 0.28, twist: 0.45 }, // down + open
        { raise: 0, out: 0.12, bend: 0.25, splay: 0.10, twist: 0.2 }, // hands forward, low
        { raise: -0.04, out: 0.22, bend: -0.30, splay: 0.06, twist: 1.15 }, // arms out, palms to the sides
    ];
    const LOW_POSES = [2, 3, 4, 5, 6];
    const gesture = { cur: GESTURES[0], t: 5 };
    function nextGesture() {
        const ids = pointer.active ? LOW_POSES : GESTURES.map((_, i) => i);
        const pool = ids.map(i => GESTURES[i]).filter(g => g !== gesture.cur);
        return pool[Math.floor(Math.random() * pool.length)];
    }
    const clock = new THREE.Clock();
    const _headNdc = new THREE.Vector3();
    let waistFollow = 0, leanFollow = 0;
    const blink = { active: false, t0: 0, next: 3.5 };
    const spinState = { active: false, t: 0, dur: 1.1 };
    const easeInOut = (x) => x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
    // the head snaps toward the cursor fast, but a per-frame angular cap keeps a
    // big jump (cursor leaving and re-entering on the far side) from teleporting
    const MAX_HEAD_SPEED = 11; // rad/s
    const stepAngle = (cur, target, dt) => {
        const next = THREE.MathUtils.damp(cur, target, 24, dt);
        const cap = MAX_HEAD_SPEED * dt;
        return cur + THREE.MathUtils.clamp(next - cur, -cap, cap);
    };
    let raf = 0, disposed = false;
    function tick() {
        if (disposed)
            return;
        raf = requestAnimationFrame(tick);
        // clamp dt so a long frame (e.g. the model parse blocking the thread, or a
        // backgrounded tab) can't jump the intro past its face-zoom in one step
        const dt = Math.min(clock.getDelta(), 0.05);
        const t = clock.elapsedTime;
        robot.position.y = Math.sin(t * 0.9) * 0.025 + 0.02; // gentle float
        // occasional blink: rows collapse and reopen over ~0.22s
        if (!blink.active && t > blink.next) {
            blink.active = true;
            blink.t0 = t;
        }
        if (blink.active) {
            const p = (t - blink.t0) / 0.22;
            if (p >= 1) {
                blink.active = false;
                blink.next = t + 2.5 + Math.random() * 4.5;
                drawEyes(eyeColor, 0);
            }
            else {
                drawEyes(eyeColor, Math.sin(Math.PI * p));
            }
        }
        // map the cursor into the canvas's own NDC (origin = the rendered robot),
        // so the aim is measured against where the robot actually is on screen
        let px = 0, py = 0;
        if (pointer.active) {
            const r = renderer.domElement.getBoundingClientRect();
            px = ((pointer.clientX - r.left) / (r.width || 1)) * 2 - 1;
            py = ((pointer.clientY - r.top) / (r.height || 1)) * 2 - 1;
        }
        if (headPivot) {
            // aim relative to the head's own screen position: cursor on the face
            // means looking straight ahead. Near-instant, jitter-smoothed only.
            let lookY, lookX;
            if (pointer.active) {
                headPivot.getWorldPosition(_headNdc).project(camera);
                const hx = _headNdc.x, hy = -_headNdc.y;
                // tanh: steep near the head, saturating toward the screen edges
                lookY = Math.tanh((px - hx) * 3.2) * 0.75;
                lookX = THREE.MathUtils.clamp(Math.tanh((py - hy) * 3.0) * 0.45 + 0.06, -0.32, 0.5);
            }
            else {
                lookY = Math.sin(t * 0.5) * 0.14;
                lookX = Math.sin(t * 0.8) * 0.05 + 0.04;
            }
            headPivot.rotation.y = stepAngle(headPivot.rotation.y, lookY, dt);
            headPivot.rotation.x = stepAngle(headPivot.rotation.x, lookX, dt);
        }
        // the base stays planted: tiny gaze pitch, a hint of turn, nothing more
        const headPitchNow = headPivot ? headPivot.rotation.x : 0;
        if (waistPivot) {
            waistFollow = THREE.MathUtils.damp(waistFollow, pointer.active ? px * 0.025 : 0, 14, dt);
            waistPivot.rotation.y = waistFollow + Math.sin(t * 0.45) * 0.018 + Math.sin(t * 0.21 + 1.3) * 0.01;
            waistPivot.rotation.z = Math.sin(t * 0.6 + 0.7) * 0.008;
            waistPivot.rotation.x = Math.sin(t * 1.6) * 0.008 + headPitchNow * 0.12;
        }
        gesture.t -= dt;
        if (gesture.t <= 0) {
            gesture.t = 5 + Math.random() * 6;
            gesture.cur = nextGesture();
        }
        // both arms always mirror exactly; low damping = chill drifting moves
        const swayRaise = Math.sin(t * 0.5) * 0.03;
        const swayOut = Math.sin(t * 0.4 + 1) * 0.02;
        const swayBend = Math.sin(t * 0.7 + 0.6) * 0.05;
        // shoulders also swing slightly with the head's pitch
        const headPitch = headPitchNow;
        for (const rig of armRigs) {
            const g = gesture.cur;
            const d = (cur, target) => THREE.MathUtils.damp(cur, target, 1.2, dt);
            rig.shoulder.rotation.x = d(rig.shoulder.rotation.x, rig.raiseSign * (g.raise + swayRaise + headPitch * 0.22));
            rig.shoulder.rotation.y = d(rig.shoulder.rotation.y, 0);
            rig.shoulder.rotation.z = d(rig.shoulder.rotation.z, rig.outSign * (g.out + swayOut));
            if (rig.elbow) {
                rig.elbow.rotation.x = d(rig.elbow.rotation.x, rig.bendSign * (g.bend + swayBend));
                rig.elbow.rotation.y = d(rig.elbow.rotation.y, rig.splaySign * g.splay);
            }
            // forearm pronation: per-pose palm twist plus a gentle ever-turning
            // sway. Same value for both arms — the mirrored instance flips it
            // visually, which is exactly what keeps the palms symmetric.
            if (rig.twist) {
                const tw = (g.twist || 0) + Math.sin(t * 0.45 + 1.7) * 0.10 + Math.sin(t * 1.1 + 0.4) * 0.05;
                rig.twist.rotation.y = THREE.MathUtils.damp(rig.twist.rotation.y, tw, 1.2, dt);
            }
        }
        if (spinState.active) {
            spinState.t += dt;
            const k = Math.min(spinState.t / spinState.dur, 1);
            robot.rotation.y = easeInOut(k) * Math.PI * 2;
            if (k >= 1) {
                spinState.active = false;
                robot.rotation.y = 0;
            }
        }
        else {
            leanFollow = THREE.MathUtils.damp(leanFollow, pointer.active ? px * 0.022 : 0, 14, dt);
            robot.rotation.y = leanFollow + (pointer.active ? 0 : Math.sin(t * 0.4) * 0.02);
        }
        // one-time zoom-in entrance; hands control to OrbitControls when finished
        if (introState.active) {
            introState.t += dt;
            const k = Math.min(introState.t / introState.dur, 1);
            // easeInOutQuint: a long, slow hold on the face, then accelerates and settles
            const e = k < 0.5 ? 16 * k ** 5 : 1 - Math.pow(-2 * k + 2, 5) / 2;
            camera.position.lerpVectors(introFromPos, camEnd, e);
            _introLook.lerpVectors(introFromLook, camTarget, e);
            camera.lookAt(_introLook);
            if (k >= 1) {
                introState.active = false;
                if (controls)
                    controls.enabled = true;
            }
        }
        else if (controls) {
            controls.update();
        }
        renderer.render(scene, camera);
    }
    /* --------------------------------------------------------------- sizing */
    function resize() {
        const w = container.clientWidth || 1, h = container.clientHeight || 1;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
    }
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    /* ------------------------------------------------------------------ API */
    const state = { logoText: opts.logoText, logoColor: opts.logoColor, legs: opts.legs !== false };
    function set(o = {}) {
        if ('legs' in o && o.legs !== undefined) {
            state.legs = !!o.legs;
            if (bottomNode)
                bottomNode.visible = state.legs;
        }
        if (o.primary) {
            materials.primary.color.set(o.primary);
            materials.primaryPlain.color.set(o.primary).multiplyScalar(0.65);
            materials.carbon.color.set(o.primary).multiplyScalar(2.0);
        }
        if (o.accent)
            materials.joint.color.set(o.accent);
        if (o.visor)
            materials.visor.color.set(o.visor);
        if (o.hands)
            materials.chrome.color.set(o.hands);
        if (o.eyes)
            drawEyes(o.eyes);
        if (o.logoColor) {
            state.logoColor = o.logoColor;
            drawLogoText(state.logoText, state.logoColor);
        }
        if ('logoText' in o && o.logoText !== undefined) {
            state.logoText = o.logoText;
            drawLogoText(o.logoText, state.logoColor);
        }
        if (o.logoImage) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => drawLogoImage(img);
            img.src = o.logoImage;
        }
        return api;
    }
    function dispose() {
        disposed = true;
        cancelAnimationFrame(raf);
        observer.disconnect();
        if (controls)
            controls.dispose();
        if (opts.trackPointer) {
            pointerTarget.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('mouseleave', onLeave);
        }
        renderer.dispose();
        pmrem.dispose();
        renderer.domElement.remove();
    }
    const api = {
        set,
        spin: () => { spinState.active = true; spinState.t = 0; },
        replay: () => { introState.active = true; introState.t = 0; if (controls)
            controls.enabled = false; },
        dispose, scene, camera, renderer,
    };
    drawEyes(opts.eyes);
    drawLogoText(opts.logoText, opts.logoColor);
    set(opts);
    tick();
    return api;
}
