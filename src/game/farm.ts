import Phaser from 'phaser';

const MAP_KEY = 'village';
const MAP_URL = '/assets/map/village.tmj';
const MAP_BASE = '/assets/map/';
const MAP_W = 640;
const MAP_H = 496;
const STATIC_MAP_KEY = 'static-map';
const STATIC_MAP_URL = '/assets/map/generated/static_tiles_merged_render.png';
const PLAYER_KEY = 'player';
const PLAYER_URL = '/assets/cute-fantasy/player.png';

const PORTAL_LAYERS = new Set([
  'Project',
  'Study_notes',
  'resume',
  'about_me',
  'Leetcode',
  'Contact',
  'Experience',
]);

const NICE_LABELS: Record<string, string> = {
  about_me: 'About',
  Experience: 'Work blog',
  Study_notes: 'Study',
  Project: 'Project',
  Leetcode: 'LeetCode',
  Contact: 'Connect me',
  resume: 'Resume',
};

// Fallback routes used when a Tiled object has no `route` custom property.
const DEFAULT_ROUTES: Record<string, string> = {
  about_me: '/about',
  Experience: '/experience',
  Study_notes: '/learning',
  Project: '/projects',
  Leetcode: '/leetcode',
  Contact: '/contact',
  resume: '/resume',
};


type TiledProperty = {
  name: string;
  type?: string;
  value: string | number | boolean;
};

type TiledTileset = {
  columns?: number;
  firstgid: number;
  image?: string;
  imageheight?: number;
  imagewidth?: number;
  name: string;
  tilecount?: number;
  tileheight: number;
  tiles?: Array<{
    animation?: Array<{ duration: number; tileid: number }>;
    id: number;
  }>;
  tilewidth: number;
};

type TiledTextObject = {
  text: string;
  fontfamily?: string;
  pixelsize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  halign?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'center' | 'bottom';
  wrap?: boolean;
  underline?: boolean;
};

type TiledObject = {
  gid?: number;
  height?: number;
  id: number;
  name?: string;
  properties?: TiledProperty[];
  text?: TiledTextObject;
  type?: string;
  visible?: boolean;
  width?: number;
  x?: number;
  y?: number;
};

type TiledLayer = {
  data?: number[];
  name: string;
  objects?: TiledObject[];
  type: string;
  visible?: boolean;
};

type TiledMapJson = {
  layers: TiledLayer[];
  tilesets: TiledTileset[];
};

type Portal = {
  height: number;
  highlight: Phaser.GameObjects.Rectangle;
  label: string;
  labelKey: string;
  rect: Phaser.GameObjects.Rectangle;
  route: string;
  width: number;
  x: number;
  y: number;
};

class VillageScene extends Phaser.Scene {
  cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  keys!: Record<'a' | 'd' | 'e' | 's' | 'w', Phaser.Input.Keyboard.Key>;
  mapJson!: TiledMapJson;
  player!: Phaser.Physics.Arcade.Sprite;
  prompt!: Phaser.GameObjects.Text;
  portals: Portal[] = [];
  activePortal?: Portal;
  labelObjects = new Map<string, Phaser.GameObjects.GameObject[]>();
  sortable: Phaser.GameObjects.GameObject[] = [];
  posTick = 0;
  modalOpen = false;
  teleporting = false;
  gameStarted = false;
  demoActive = false;
  demoToken = 0;
  demoIdx = 0;
  demoStops: { x: number; y: number; label: string }[] = [];
  lastInputTime = 0;
  IDLE_MS = 20000;
  virtualInput = { up: false, down: false, left: false, right: false, enter: false };

  constructor() {
    super('Village');
  }

  preload() {
    this.load.tilemapTiledJSON(MAP_KEY, MAP_URL);
    this.load.image(STATIC_MAP_KEY, STATIC_MAP_URL);
    this.load.spritesheet(PLAYER_KEY, PLAYER_URL, {
      frameWidth: 32,
      frameHeight: 32,
    });
  }

  create() {
    const map = this.make.tilemap({ key: MAP_KEY });
    this.mapJson = this.cache.tilemap.get(MAP_KEY).data as TiledMapJson;

    this.loadMapImagesFromCache();
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.buildMap(map);
    });
    this.load.start();
  }

  update() {
    if (!this.player) return;

    // Freeze player before game starts, during demo, or while fast-travel is animating.
    if (!this.gameStarted || this.demoActive || this.teleporting) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      if (this.prompt) this.prompt.setVisible(false);
      return;
    }

    // (Idle-triggered demo removed — demo only runs on the landing screen.)

    const speed = 86;
    let vx = 0;
    let vy = 0;

    if (this.cursors.left.isDown || this.keys.a.isDown) vx -= speed;
    if (this.cursors.right.isDown || this.keys.d.isDown) vx += speed;
    if (this.cursors.up.isDown || this.keys.w.isDown) vy -= speed;
    if (this.cursors.down.isDown || this.keys.s.isDown) vy += speed;
    if (this.virtualInput.left) vx -= speed;
    if (this.virtualInput.right) vx += speed;
    if (this.virtualInput.up) vy -= speed;
    if (this.virtualInput.down) vy += speed;

    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }

    const prevActive = this.activePortal;
    this.activePortal = this.portals.find((portal) => (
      this.player.x >= portal.x
      && this.player.x <= portal.x + portal.width
      && this.player.y >= portal.y
      && this.player.y <= portal.y + portal.height
    ));
    if (prevActive && prevActive !== this.activePortal) {
      this.setLabelActive(prevActive.labelKey, false);
      if (this.modalOpen) this.dispatchPortalClose();
    }
    if (this.activePortal) {
      this.setLabelActive(this.activePortal.labelKey, true);
      if (prevActive !== this.activePortal && !this.modalOpen) {
        this.dispatchPortalOpen(this.activePortal);
      }
      this.prompt?.setText(`Entering ${this.activePortal.label}`);
      this.prompt?.setPosition(this.scale.width / 2, this.scale.height - 24);
      this.prompt?.setVisible(!this.modalOpen);
    } else {
      this.prompt?.setVisible(false);
    }

    this.player.setVelocity(vx, vy);

    if (vy > 0) {
      this.player.setFlipX(false);
      this.player.play('player-walk-down', true);
    } else if (vy < 0) {
      this.player.setFlipX(false);
      this.player.play('player-walk-up', true);
    } else if (vx < 0) {
      this.player.setFlipX(true);
      this.player.play('player-walk-side', true);
    } else if (vx > 0) {
      this.player.setFlipX(false);
      this.player.play('player-walk-side', true);
    } else this.player.anims.stop();

    if (this.virtualInput.enter) this.virtualInput.enter = false;

    this.sortable.forEach((object) => {
      const sprite = object as Phaser.GameObjects.Sprite;
      sprite.setDepth(Math.round(sprite.y));
    });

    // Throttled player position broadcast for HTML minimap (every ~6 frames)
    this.posTick = (this.posTick + 1) % 6;
    if (this.posTick === 0) {
      window.dispatchEvent(new CustomEvent('player-move', {
        detail: { x: this.player.x, y: this.player.y },
      }));
    }
  }

  private dispatchPortalOpen(portal: Portal) {
    window.dispatchEvent(new CustomEvent('portal-open', {
      detail: { route: portal.route, label: portal.label },
    }));
  }

  private dispatchPortalClose() {
    window.dispatchEvent(new CustomEvent('portal-close'));
  }

  private dispatchPortalsReady() {
    const portalsForHud = this.portals.map((p) => ({
      x: p.x + p.width / 2,
      y: p.y + p.height / 2,
      label: p.label,
      route: p.route,
    }));
    window.dispatchEvent(new CustomEvent('portals-ready', {
      detail: { mapW: MAP_W, mapH: MAP_H, portals: portalsForHud },
    }));
  }

  private bindTeleportListener() {
    const teleportHandler = (e: Event) => {
      const ce = e as CustomEvent<{ x: number; y: number; route: string; label: string }>;
      if (!this.player || !ce.detail) return;
      this.stopDemoTour();
      this.dispatchPortalClose();
      this.teleporting = true;
      this.modalOpen = false;
      if (this.activePortal) {
        this.setLabelActive(this.activePortal.labelKey, false);
        this.activePortal = undefined;
      }
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      this.lastInputTime = this.time.now;
      const targetPortal = this.portals.find((p) => p.route === ce.detail.route);
      const dx = ce.detail.x - this.player.x;
      const dy = ce.detail.y - this.player.y;
      const duration = Phaser.Math.Clamp(Math.hypot(dx, dy) * 2.2, 420, 950);
      window.dispatchEvent(new CustomEvent('teleport-start', {
        detail: { route: ce.detail.route, label: ce.detail.label, duration },
      }));
      this.tweens.add({
        targets: this.player,
        x: ce.detail.x,
        y: ce.detail.y,
        duration,
        ease: 'Sine.easeInOut',
        onUpdate: () => {
          this.cameras.main.centerOn(this.player.x, this.player.y);
          window.dispatchEvent(new CustomEvent('player-move', {
            detail: { x: this.player.x, y: this.player.y },
          }));
        },
        onComplete: () => {
          this.teleporting = false;
          if (targetPortal) {
            this.activePortal = targetPortal;
            this.setLabelActive(targetPortal.labelKey, true);
            this.dispatchPortalOpen(targetPortal);
          } else {
            this.dispatchPortalOpen({
              route: ce.detail.route,
              label: ce.detail.label,
            } as Portal);
          }
          window.dispatchEvent(new CustomEvent('teleport-end', {
            detail: { route: ce.detail.route, label: ce.detail.label },
          }));
        },
      });
    };
    const openedHandler = () => { this.modalOpen = true; };
    const closedHandler = () => {
      this.modalOpen = false;
      this.lastInputTime = this.time.now;
    };
    window.addEventListener('teleport-request', teleportHandler);
    window.addEventListener('modal-opened', openedHandler);
    window.addEventListener('modal-closed', closedHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('teleport-request', teleportHandler);
      window.removeEventListener('modal-opened', openedHandler);
      window.removeEventListener('modal-closed', closedHandler);
    });
  }

  private bindGameStateListeners() {
    const startHandler = () => {
      this.gameStarted = true;
      this.stopDemoTour();
      this.lastInputTime = this.time.now;
      if (this.player) {
        this.player.setVisible(true);
        this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      }
    };
    const demoStartHandler = () => {
      if (this.gameStarted) return;
      this.startDemoTour();
    };
    const virtualInputHandler = (event: Event) => {
      const detail = (event as CustomEvent<{ key: keyof typeof this.virtualInput; pressed: boolean }>).detail;
      if (!detail) return;
      this.virtualInput[detail.key] = detail.pressed;
    };
    window.addEventListener('game-start', startHandler);
    window.addEventListener('demo-tour-start', demoStartHandler);
    window.addEventListener('virtual-input', virtualInputHandler);

    // Throttled input tracker
    let lastReset = 0;
    const resetIdle = () => {
      const now = performance.now();
      if (now - lastReset < 80) return;
      lastReset = now;
      if (!this.gameStarted) return;
      this.lastInputTime = this.time.now;
      if (this.demoActive) this.stopDemoTour();
    };
    window.addEventListener('pointermove', resetIdle, { passive: true });
    window.addEventListener('pointerdown', resetIdle, { passive: true });
    window.addEventListener('keydown', resetIdle, { passive: true });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('game-start', startHandler);
      window.removeEventListener('demo-tour-start', demoStartHandler);
      window.removeEventListener('virtual-input', virtualInputHandler);
      window.removeEventListener('pointermove', resetIdle);
      window.removeEventListener('pointerdown', resetIdle);
      window.removeEventListener('keydown', resetIdle);
    });
  }

  // Shuffles stops so consecutive pans go in varied directions (not just up/down).
  // Heuristic: greedy — for each next slot, pick a remaining stop whose vector
  // from current isn't too close to the previous vector direction.
  private shuffleTour(stops: { x: number; y: number; label: string }[]) {
    if (stops.length <= 2) return stops;
    const remaining = [...stops];
    const order: typeof stops = [];
    // Random first stop
    order.push(remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0]);
    let prevVec: { x: number; y: number } | null = null;
    while (remaining.length > 0) {
      const current = order[order.length - 1];
      // Score each candidate: prefer one whose vector is most different from prevVec.
      let bestIdx = 0;
      let bestScore = -Infinity;
      remaining.forEach((cand, idx) => {
        const dx = cand.x - current.x;
        const dy = cand.y - current.y;
        const len = Math.hypot(dx, dy) || 1;
        const vx = dx / len, vy = dy / len;
        let score = len; // prefer farther stops for sweeping motion
        if (prevVec) {
          // Penalize same-direction (dot product close to 1)
          const dot = vx * prevVec.x + vy * prevVec.y;
          score += (1 - dot) * 400; // boost different-direction picks
        }
        // Small random jitter
        score += Math.random() * 50;
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      });
      const chosen = remaining.splice(bestIdx, 1)[0];
      const dx = chosen.x - current.x;
      const dy = chosen.y - current.y;
      const len = Math.hypot(dx, dy) || 1;
      prevVec = { x: dx / len, y: dy / len };
      order.push(chosen);
    }
    return order;
  }

  private startDemoTour() {
    if (this.demoStops.length === 0) return;
    this.demoActive = true;
    this.demoToken += 1;
    const token = this.demoToken;
    this.cameras.main.stopFollow();
    this.demoIdx = 0;
    this.runDemoStep(token);
  }

  private stopDemoTour() {
    if (!this.demoActive) return;
    this.demoActive = false;
    this.demoToken += 1;
    this.cameras.main.panEffect?.reset();
    if (this.gameStarted && this.player) {
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    }
  }

  private runDemoStep(token: number) {
    if (token !== this.demoToken || !this.demoActive) return;
    const stop = this.demoStops[this.demoIdx];
    if (!stop) return;
    const PAN_MS = 2600;
    const HOLD_MS = 1600;
    this.cameras.main.pan(stop.x, stop.y, PAN_MS, 'Sine.easeInOut');
    this.time.delayedCall(PAN_MS + HOLD_MS, () => {
      if (token !== this.demoToken || !this.demoActive) return;
      this.demoIdx = (this.demoIdx + 1) % this.demoStops.length;
      this.runDemoStep(token);
    });
  }

  private loadMapImagesFromCache() {
    const usedObjectTilesets = new Set<TiledTileset>();
    this.mapJson.layers.forEach((layer) => {
      layer.objects?.forEach((object) => {
        if (!object.gid) return;
        const tileset = this.tilesetForGid(object.gid);
        if (tileset) usedObjectTilesets.add(tileset);
      });
    });

    this.mapJson.tilesets.forEach((tileset) => {
      if (!tileset.image) return;
      if (!usedObjectTilesets.has(tileset)) return;

      const key = this.tilesetKey(tileset);
      if (this.textures.exists(key)) return;
      this.load.spritesheet(key, `${MAP_BASE}${tileset.image}`, {
        frameWidth: tileset.tilewidth,
        frameHeight: tileset.tileheight,
      });
    });
  }

  private buildMap(_map: Phaser.Tilemaps.Tilemap) {
    this.cameras.main.setBackgroundColor('#5a8a3a');
    this.add.image(0, 0, STATIC_MAP_KEY).setOrigin(0).setDepth(0);

    this.createTiledAnimations();
    this.renderObjectSprites();
    this.renderTextObjects();
    this.createPlayer();
    this.createCollisionBodies();
    this.createPortals();
    this.createPrompt();
    this.configureCamera();
    this.bindTeleportListener();
    this.bindGameStateListeners();
    this.dispatchPortalsReady();

    // Compute demo tour stops — portals + 4 corners + center, then shuffle
    // so panning hops in varied directions instead of straight up/down.
    const seen = new Set<string>();
    const portalStops: { x: number; y: number; label: string }[] = [];
    this.portals.forEach((p) => {
      if (seen.has(p.route)) return;
      seen.add(p.route);
      portalStops.push({ x: p.x + p.width / 2, y: p.y + p.height / 2, label: p.label });
    });
    const M = 80;
    const cornerStops = [
      { x: M,         y: M,         label: 'tl' },
      { x: MAP_W - M, y: M,         label: 'tr' },
      { x: M,         y: MAP_H - M, label: 'bl' },
      { x: MAP_W - M, y: MAP_H - M, label: 'br' },
      { x: MAP_W / 2, y: MAP_H / 2, label: 'center' },
    ];
    this.demoStops = this.shuffleTour([...portalStops, ...cornerStops]);

    // Hide player until game starts
    this.player?.setVisible(false);

    // Tell HTML that game is ready (loading → landing)
    window.dispatchEvent(new CustomEvent('game-ready'));
  }

  private getSpawn(): { x: number; y: number } {
    // Read spawn from a Tiled object layer named 'spawn'.
    // Accepts both Point objects (x, y) and Rectangle objects (uses center).
    // Falls back to a hard-coded position if missing.
    const FALLBACK = { x: 325, y: 250 };
    const layer = this.mapJson.layers.find(
      (l) => l.name?.toLowerCase() === 'spawn',
    );
    const object = layer?.objects?.[0];
    if (!object) {
      console.warn('[spawn] No "spawn" object layer found in tmj — using fallback.');
      return FALLBACK;
    }
    const x = (object.x ?? 0) + (object.width ?? 0) / 2;
    const y = (object.y ?? 0) + (object.height ?? 0) / 2;
    return { x, y };
  }

  private createPlayer() {
    this.anims.create({
      key: 'player-walk-down',
      frames: this.anims.generateFrameNumbers(PLAYER_KEY, { start: 18, end: 23 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-walk-side',
      frames: this.anims.generateFrameNumbers(PLAYER_KEY, { start: 24, end: 29 }),
      frameRate: 8,
      repeat: -1,
    });
    this.anims.create({
      key: 'player-walk-up',
      frames: this.anims.generateFrameNumbers(PLAYER_KEY, { start: 30, end: 35 }),
      frameRate: 8,
      repeat: -1,
    });

    const spawn = this.getSpawn();
    this.player = this.physics.add.sprite(spawn.x, spawn.y, PLAYER_KEY, 0);
    this.player.setOrigin(0.5, 0.85);
    this.player.setDepth(this.player.y);
    this.player.setCollideWorldBounds(true);
    this.player.body?.setSize(12, 10);
    this.player.body?.setOffset(10, 20);
    this.sortable.push(this.player);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys('W,A,S,D,E') as Record<'a' | 'd' | 'e' | 's' | 'w', Phaser.Input.Keyboard.Key>;
    this.keys.w = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keys.a = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A);
    this.keys.s = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keys.d = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    this.keys.e = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);
  }

  private createCollisionBodies() {
    const collisions = this.mapJson.layers.find((layer) => layer.name === 'collisions');
    if (!collisions?.objects?.length) return;

    const group = this.physics.add.staticGroup();
    collisions.objects.forEach((object) => {
      const width = object.width ?? 0;
      const height = object.height ?? 0;
      if (width <= 0 || height <= 0) return;

      const rect = this.add.rectangle((object.x ?? 0) + width / 2, (object.y ?? 0) + height / 2, width, height);
      this.physics.add.existing(rect, true);
      group.add(rect);
      rect.setVisible(false);
    });

    this.physics.add.collider(this.player, group);
  }

  private createPortals() {
    PORTAL_LAYERS.forEach((layerName) => {
      const layer = this.mapJson.layers.find((candidate) => candidate.name === layerName);
      if (!layer?.objects?.length) {
        console.warn(`[portal] Layer "${layerName}" missing or has no objects.`);
        return;
      }
      layer.objects.forEach((object) => {
        const route = this.property(object, 'route') || DEFAULT_ROUTES[layerName] || '';
        if (!route) {
          console.warn(`[portal] Object in layer "${layerName}" has no route; skipping.`);
          return;
        }

        // Point objects have width=0/height=0; give them a reasonable trigger zone.
        const rawW = object.width ?? 0;
        const rawH = object.height ?? 0;
        const width = rawW > 0 ? rawW : 24;
        const height = rawH > 0 ? rawH : 24;
        // For point objects, the (x, y) IS the point — center the zone on it.
        const x = (object.x ?? 0) - (rawW > 0 ? 0 : width / 2);
        const y = (object.y ?? 0) - (rawH > 0 ? 0 : height / 2);

        const niceLabel = NICE_LABELS[layerName] ?? layerName.replace(/_/g, ' ');
        const rect = this.add.rectangle(x + width / 2, y + height / 2, width, height);
        rect.setVisible(false);
        this.physics.add.existing(rect, true);
        const highlight = this.add.rectangle(x + width / 2, y + height / 2, width + 8, height + 8, 0xfff4d6, 0.35);
        highlight.setStrokeStyle(2, 0xe89653, 0.9);
        highlight.setDepth(8998);
        highlight.setVisible(false);

        const portal = {
          height,
          highlight,
          labelKey: layerName,
          label: niceLabel,
          rect,
          route,
          width,
          x,
          y,
        };
        this.portals.push(portal);
      });
    });
    console.info(`[portal] Loaded ${this.portals.length} portals.`);
  }

  private createPrompt() {
    this.prompt = this.add.text(0, 0, '', {
      backgroundColor: '#3a2418',
      color: '#fff4d6',
      fontFamily: '"Pixelify Sans", system-ui, sans-serif',
      fontSize: '12px',
      padding: { x: 8, y: 5 },
    });
    this.prompt.setOrigin(0.5, 1);
    this.prompt.setDepth(10000);
    this.prompt.setScrollFactor(0);
    this.prompt.setVisible(false);
  }

  // Render text objects authored directly in Tiled.
  // In Tiled: Object Layer → Insert Text tool (T) → click on map → type text.
  //
  // Built-in Tiled fields read: text, fontfamily, pixelsize, color, bold,
  // italic, halign/valign, wrap.
  //
  // Custom Tiled properties read (optional):
  //   - bg_color (color):   filled rectangle behind text  e.g. #3a2418
  //   - bg_padding (float): pixels of padding inside bg   e.g. 4
  //   - stroke_color (color): outline color around glyphs e.g. #1a0e08
  //   - stroke_width (float): outline thickness in px     e.g. 2
  private renderTextObjects() {
    this.mapJson.layers.forEach((layer) => {
      if (layer.type !== 'objectgroup' || layer.visible === false) return;
      layer.objects?.forEach((object) => {
        const t = object.text;
        if (!t || !t.text || object.visible === false) return;

        const x = object.x ?? 0;
        const y = object.y ?? 0;
        const w = object.width ?? 0;
        const h = object.height ?? 0;

        const halign = t.halign ?? 'left';
        const valign = t.valign ?? 'top';

        let posX = x, originX = 0;
        if (halign === 'center')     { posX = x + w / 2; originX = 0.5; }
        else if (halign === 'right') { posX = x + w;     originX = 1; }

        let posY = y, originY = 0;
        if (valign === 'center')      { posY = y + h / 2; originY = 0.5; }
        else if (valign === 'bottom') { posY = y + h;     originY = 1; }

        const textColor = this.tiledColorToCss(t.color) ?? '#ffffff';
        const text = this.add.text(posX, posY, t.text, {
          fontFamily: t.fontfamily ? `"${t.fontfamily}", system-ui, sans-serif` : '"Pixelify Sans", system-ui, sans-serif',
          fontSize: `${t.pixelsize ?? 14}px`,
          color: textColor,
          fontStyle: [t.bold && 'bold', t.italic && 'italic'].filter(Boolean).join(' ') || 'normal',
          align: halign === 'justify' ? 'left' : halign,
        });
        text.setOrigin(originX, originY);
        text.setDepth(9000);
        text.setAlpha(0.72);
        text.setResolution(2);

        // Optional outline (defaults to a tiny dark stroke for legibility).
        const strokeColor = this.tiledColorToCss(this.property(object, 'stroke_color')) ?? '#1a0e08';
        const strokeWidthRaw = this.property(object, 'stroke_width');
        const strokeWidth = strokeWidthRaw ? parseFloat(strokeWidthRaw) : 2;
        if (strokeWidth > 0) text.setStroke(strokeColor, strokeWidth);

        if (t.wrap && w > 0) text.setWordWrapWidth(w);

        // Optional background plaque (read from custom property).
        // Uses the bounding box you drew in Tiled as the bg rectangle —
        // resize the frame in Tiled to control bg size directly.
        const bgColorRaw = this.property(object, 'bg_color');
        if (bgColorRaw) {
          const bgPadRaw = this.property(object, 'bg_padding');
          const pad = bgPadRaw ? parseFloat(bgPadRaw) : 4;
          const { color: bgColorNum, alpha: bgAlpha } = this.tiledColorToRgba(bgColorRaw);

          let bgCx: number, bgCy: number, bgW: number, bgH: number;
          if (w > 0 && h > 0) {
            // Use Tiled's drawn frame
            bgCx = x + w / 2;
            bgCy = y + h / 2;
            bgW = w + pad * 2;
            bgH = h + pad * 2;
          } else {
            // Fallback: fit to text bounds
            text.updateText();
            const b = text.getBounds();
            bgCx = b.centerX;
            bgCy = b.centerY;
            bgW = b.width + pad * 2;
            bgH = b.height + pad * 2;
          }
          const bg = this.add.rectangle(bgCx, bgCy, bgW, bgH, bgColorNum, bgAlpha);
          bg.setDepth(text.depth - 1);
          bg.setAlpha(0.78);
          this.registerLabelObject(object.name, bg);
        }
        this.registerLabelObject(object.name, text);
      });
    });
  }

  private registerLabelObject(name: string | undefined, object: Phaser.GameObjects.GameObject) {
    const key = this.labelKeyFromObjectName(name);
    if (!key) return;
    const objects = this.labelObjects.get(key) ?? [];
    objects.push(object);
    this.labelObjects.set(key, objects);
  }

  private labelKeyFromObjectName(name: string | undefined) {
    const normalized = (name ?? '').toLowerCase();
    if (normalized.includes('contact')) return 'Contact';
    if (normalized.includes('project')) return 'Project';
    if (normalized.includes('about')) return 'about_me';
    if (normalized.includes('leetcode')) return 'Leetcode';
    if (normalized.includes('study')) return 'Study_notes';
    if (normalized.includes('resume')) return 'resume';
    if (normalized.includes('experience')) return 'Experience';
    return '';
  }

  private setLabelActive(key: string, active: boolean) {
    const objects = this.labelObjects.get(key);
    if (!objects) return;
    objects.forEach((object) => {
      const display = object as Phaser.GameObjects.GameObject & { setAlpha?: (value: number) => void };
      display.setAlpha?.(active ? 1 : 0.72);
    });
  }

  // Tiled color format is "#aarrggbb" (or "#rrggbb"). Convert to CSS hex.
  private tiledColorToCss(hex: string | undefined | null): string | null {
    if (!hex) return null;
    let s = hex.replace('#', '');
    if (s.length === 8) s = s.substring(2); // drop alpha for CSS
    if (s.length !== 6) return null;
    return '#' + s;
  }

  private tiledColorToRgba(hex: string): { color: number; alpha: number } {
    let s = hex.replace('#', '');
    let alpha = 1;
    if (s.length === 8) {
      alpha = parseInt(s.substring(0, 2), 16) / 255;
      s = s.substring(2);
    }
    return { color: parseInt(s, 16) || 0, alpha };
  }

  private renderObjectSprites() {
    this.mapJson.layers.forEach((layer) => {
      if (layer.type !== 'objectgroup' || layer.name === 'collisions' || PORTAL_LAYERS.has(layer.name)) return;

      layer.objects?.forEach((object) => {
        if (!object.gid || object.visible === false) return;

        const tileset = this.tilesetForGid(object.gid);
        if (!tileset) return;

        const key = this.tilesetKey(tileset);
        const gid = object.gid & 0x1fffffff;
        const sprite = this.add.sprite(object.x ?? 0, object.y ?? 0, key, gid - tileset.firstgid);
        sprite.setOrigin(0, 1);
        sprite.setDisplaySize(object.width ?? tileset.tilewidth, object.height ?? tileset.tileheight);
        sprite.setDepth(Math.round(sprite.y));

        const animationKey = this.animationKey(tileset);
        if (this.anims.exists(animationKey)) sprite.play(animationKey);

        this.sortable.push(sprite);
      });
    });
  }

  private createTiledAnimations() {
    this.mapJson.tilesets.forEach((tileset) => {
      const firstAnimation = tileset.tiles?.find((tile) => tile.animation?.length);
      if (!firstAnimation?.animation?.length) return;

      const key = this.tilesetKey(tileset);
      const animationKey = this.animationKey(tileset);
      if (this.anims.exists(animationKey)) return;

      this.anims.create({
        key: animationKey,
        frames: firstAnimation.animation.map((frame) => ({
          key,
          frame: frame.tileid,
          duration: frame.duration,
        })),
        repeat: -1,
      });
    });
  }

  private configureCamera() {
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(this.zoomForViewport());
    this.scale.on('resize', () => {
      this.cameras.main.setZoom(this.zoomForViewport());
    });
  }

  private zoomForViewport() {
    // Multiplier > 1 so visible world is smaller than the map in BOTH axes,
    // which lets the camera actually pan horizontally during the demo tour
    // (otherwise visible width == map width and horizontal scroll = 0).
    return Math.max(window.innerWidth / MAP_W, window.innerHeight / MAP_H) * 1.22;
  }

  private tilesetForGid(gidWithFlags: number) {
    const gid = gidWithFlags & 0x1fffffff;
    return [...this.mapJson.tilesets]
      .reverse()
      .find((tileset) => gid >= tileset.firstgid);
  }

  private tilesetKey(tileset: TiledTileset) {
    return `tileset-${tileset.name}`;
  }

  private animationKey(tileset: TiledTileset) {
    return `anim-${tileset.name}`;
  }

  private property(object: TiledObject, name: string) {
    const property = object.properties?.find((candidate) => candidate.name === name);
    return typeof property?.value === 'string' ? property.value : '';
  }
}

export function startFarm(parentId: string) {
  const parent = document.getElementById(parentId);
  parent?.replaceChildren();

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: parentId,
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#5a8a3a',
    pixelArt: true,
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
    scene: VillageScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      parent: parentId,
    },
  });

  const resize = () => game.scale.resize(window.innerWidth, window.innerHeight);
  window.addEventListener('resize', resize);
  setTimeout(resize, 50);

  return game;
}
