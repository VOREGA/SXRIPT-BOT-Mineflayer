const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalFollow } = goals;
const toolPlugin = require('mineflayer-tool').plugin;
const vec3 = require('vec3');
const fs = require('fs');
const { Schematic } = require('prismarine-schematic')

// --- GÖRSELLEŞTİRME PAKETLERİ ---
const inventoryViewer = require('mineflayer-web-inventory');
const { mineflayer: mineflayerViewer } = require('prismarine-viewer');

// --- ANA MODÜLLERİ YÜKLE ---
let Common;
try {
    Common = require('./fonksiyonlar/common');
} catch (e) {
    console.error("KRİTİK HATA: Common modülü yüklenemedi!", e);
    process.exit(1);
}


let SchematicBuilder;
try {
    SchematicBuilder = require('./fonksiyonlar/schematic_builder');
} catch(e) { console.log("Schematic Builder yüklenemedi (npm install prismarine-schematic yapın)."); }

class BotInstance {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.mcData = null;

        // Bot Durumları
        this.isExcavating = false;
        this.isBuilding = false;
        this.isSelling = false;
        this.isPausedForEating = false;
        this.isTossing = false;
        this.isFollowing = false;
        this.isViewerRunning = false;
        
        // --- GÜVENLİK SİSTEMLERİ ---
        this.isPatrolling = false;
        this.modCheckInterval = null; 
        
        // 1. Yasaklı Listesi (Görürse kaçar - Normal Mod)
        this.moderatorList = []; 
        
        // 2. Güvenli Listesi (Paranoid Modda bunlardan kaçmaz)
        this.whitelist = []; 
        
        // 3. Herkesden Kaç Modu (Varsayılan: Kapalı)
        this.runFromEveryone = false; 
        // ---------------------------

        this.followTarget = null;
        this.currentHungerTrigger = Math.floor(Math.random() * 3) + 17;
        
        // Görev Durumları
        this.excavationState = null;
        this.cactusState = null;
        this.patrolState = null; 
        
        this.resumeCheckTimer = null;
        this.autoSellTimer = null;
        this.armorCheckTimer = null;
        this.lastPlacedPos = null; // En son iş yapılan konumu tutar
        this.bindMethods();
    }

    isBusy() {
        const busyStates = {
            isExcavating: this.isExcavating,
            isBuilding: this.isBuilding,
            isSelling: this.isSelling,
            isTossing: this.isTossing,
            isFollowing: this.isFollowing,
            isPatrolling: this.isPatrolling,
            isWaitingOnArea: (this.resumeCheckTimer != null)
        };
        for (const [state, isActive] of Object.entries(busyStates)) {
            if (isActive) return true;
        }
        return false;
    }

    bindMethods() {
        // Common
        if (!Common || !Common.retryAction) throw new Error("Common modülü düzgün yüklenemedi.");
        this.randDelay = Common.randDelay;
        this.retryAction = Common.retryAction.bind(this);
        this.checkAndEat = Common.checkAndEat.bind(this);
        this.checkAndEquipBestArmor = Common.checkAndEquipBestArmor.bind(this);
        this.goTo = this.wrapGoTo(Common.goTo.bind(this));
        this.tossInventoryItems = Common.tossInventoryItems.bind(this);

        // Patrol
        try {
            const Patrol = require('./fonksiyonlar/patrol');
            this.startPatrol = this.wrapStartPatrol(Patrol.startPatrol.bind(this));
            this.checkDistanceAndRestartPatrol = Patrol.checkDistanceAndRestartPatrol.bind(this);
            console.log("[Sistem] Patrol (Alanı Turla) modülü yüklendi.");
        } catch (e) { console.error("HATA: patrol.js yüklenemedi.", e); }

        // Excavation
        if (this.config.features.excavator) {
            try {
                const Excavation = require('./fonksiyonlar/excavation');
                this.startExcavateTask = this.wrapStartExcavate(Excavation.startExcavateTask.bind(this));
                this.checkDistanceAndRestart = Excavation.checkDistanceAndRestart.bind(this);
                console.log("[Sistem] Excavator yüklendi.");
            } catch(e) { console.error("HATA: excavation.js yüklenemedi."); }
        }

        // Farmer Modules (GÜNCELLENDİ)
        if (this.config.features.cactusBuilder || this.config.features.farmer) {
            try {
                // --- MEVCUT MODÜLLER ---
                this.FenceFarmer = require('./fonksiyonlar/fence_farmer');
                this.IpliFarmer = require('./fonksiyonlar/ipli_farmer');
                this.TersFarmer = require('./fonksiyonlar/tersfarmer');
                
                // --- YENİ HIZLI MODÜLLER ---
                this.HizliFenceFarmer = require('./fonksiyonlar/hizli_fence_farmer');
                this.HizliIpliFarmer = require('./fonksiyonlar/hizli_ipli_farmer');
                this.HizliTersFarmer = require('./fonksiyonlar/hizli_tersfarmer');

                console.log("[Sistem] Tüm Farmer (Normal + Hızlı) modülleri yüklendi.");
                
                // Loglama fonksiyonu
                if (this.FenceFarmer.logPlaceCoords) this.logPlaceCoords = this.FenceFarmer.logPlaceCoords.bind(this);
                
                if (this.config.features.cactusBuilder) {
                    // --- NORMAL BAŞLATMA ---
                    this.startFenceCactus = this.wrapStartCactus(this.FenceFarmer.startCactusTask.bind(this));
                    this.startIpliCactus = this.wrapStartCactus(this.IpliFarmer.startCactusTask.bind(this));
                    this.startTersCactus  = this.wrapStartCactus(this.TersFarmer.startCactusTask.bind(this));

                    // --- HIZLI BAŞLATMA ---
                    this.startHizliFenceCactus = this.wrapStartCactus(this.HizliFenceFarmer.startCactusTask.bind(this));
                    this.startHizliIpliCactus = this.wrapStartCactus(this.HizliIpliFarmer.startCactusTask.bind(this));
                    this.startHizliTersCactus = this.wrapStartCactus(this.HizliTersFarmer.startCactusTask.bind(this));
                }

                if (this.config.features.farmer) {
                    // Satış fonksiyonları (Kaldırıldı veya var olanı kullanabilirsin)
                    if (this.FenceFarmer.startAutoSellInterval) {
                        this.startAutoSellInterval = this.FenceFarmer.startAutoSellInterval.bind(this);
                    }
                    if (this.FenceFarmer.handleSellGUI) {
                        this.handleSellGUI = this.FenceFarmer.handleSellGUI.bind(this);
                    }
                }
            } catch(e) { console.error("HATA: Farmer modülleri yüklenemedi.", e); }
        }
    } // <--- İŞTE BU PARANTEZ EKSİKTİ

    // Wrappers
    wrapGoTo(fn) { return async (pos) => { if (this.isBusy()) throw new Error('Bot meşgul.'); return fn(pos); }; }
    wrapStartExcavate(fn) { return (b) => { if (!this.bot || !this.bot.entity) throw new Error('Bot yok.'); if (this.isBusy()) throw new Error('Meşgul.'); return fn(b); }; }
    wrapStartCactus(fn) { return async (l) => { if (this.isBusy()) throw new Error("Meşgul."); return fn(l); }; }
    wrapStartPatrol(fn) { return async (b) => { if (this.isBusy()) throw new Error('Meşgul.'); this.deleteState(); this.excavationState = null; this.cactusState = null; this.patrolState = null; return fn(b); }; }

    start() {
        console.log(`[${this.config.username}] Bot oluşturuluyor... Host: ${this.config.host}`);
        this.bot = mineflayer.createBot({ host: this.config.host, username: this.config.username, version: this.config.version });
        this.bot.loadPlugin(pathfinder);
        this.bot.loadPlugin(toolPlugin);
        this.bot.once('spawn', () => { if (!this.bot.tool) console.error("deneme logu."); });
        this.registerEvents();
        if (SchematicBuilder) {
            this.builder = new SchematicBuilder(this);
        }
    }

    registerEvents() {
        this.bot.on('login', () => {
            console.log(`[${this.config.username}] Login.`);
            let delay = 5000;
            for (const cmd of this.config.loginCommands) { setTimeout(() => { if(this.bot) this.bot.chat(cmd); }, delay); delay += 5000; }
        });

        this.bot.once('spawn', () => {
            console.log(`[${this.config.username}] Spawn.`);
            this.mcData = require('minecraft-data')(this.bot.version);
            this.bot.pathfinder.setMovements(new Movements(this.bot, this.mcData));

       // --- GÖRÜNTÜ VE ENVANTER SERVERLARINI BAŞLAT ---
            if (!this.isViewerRunning) {
                try {
                    // Configden portları al, yoksa varsayılan kullan
                    const vPort = this.config.viewerPort || 3007;
                    const iPort = this.config.inventoryPort || 3008;

                    mineflayerViewer(this.bot, { port: vPort, firstPerson: true });
                    console.log(`[Görsel] Prismarine Viewer port ${vPort} üzerinde başlatıldı.`);
                    
                    inventoryViewer(this.bot, { port: iPort });
                    console.log(`[Envanter] Web Inventory port ${iPort} üzerinde başlatıldı.`);
                    
                    this.isViewerRunning = true; 
                } catch (err) {
                    console.error("Görselleştirme başlatılamadı (Önemsiz):", err.message);
                }
            } else {
                console.log('[Sistem] Web arayüzü zaten açık, tekrar başlatılmadı.');
            }
            // ------------------------------------------------

            setTimeout(() => this.checkAndEquipBestArmor(), 2000);
            if (this.armorCheckTimer) clearInterval(this.armorCheckTimer);
            this.armorCheckTimer = setInterval(() => { if (this.bot && !this.isBusy()) this.checkAndEquipBestArmor(); }, 10000);

            // --- GÜVENLİK DÖNGÜSÜNÜ BAŞLAT ---
            if (this.modCheckInterval) clearInterval(this.modCheckInterval);
            this.modCheckInterval = setInterval(() => this.checkSecurity(), 1000); 
            // ----------------------------------------------

            // State Yükleme
            const state = this.loadState(); 
            if (state && state.task) {
                console.log(`[${this.config.username}] [Durum] Kayıtlı görev: ${state.task}`);
                if (state.task === 'excavate') { this.excavationState = state; this.checkDistanceAndRestart(state); } 
                else if (state.task === 'cactus') {
                    this.cactusState = state;
                    const subType = state.subType || 'fence';
                    // Güvenlik için bot yeniden başlatıldığında her zaman NORMAL (Hızlı olmayan) modda devam et
                    // Çünkü "Hızlı" modlarda güvenlik kontrolleri kapalıdır.
                    if (subType === 'ipli') this.IpliFarmer.checkDistanceAndRestartCactus.call(this, state);
                    else if (subType === 'ters') this.TersFarmer.checkDistanceAndRestartCactus.call(this, state);
                    else this.FenceFarmer.checkDistanceAndRestartCactus.call(this, state);
                }
                else if (state.task === 'patrol') { this.patrolState = state; this.checkDistanceAndRestartPatrol(state); }
                
                else if (state.task === 'schematic_build') {
                    console.log(`[${this.config.username}] [Durum] İnşaat görevi geri yükleniyor...`);
                    setTimeout(() => {
                        if (this.builder) {
                            this.builder.resume(state).catch(e => console.error("Resume hatası:", e));
                        }
                    }, 3000);
                }

            } else {
                if (state) this.deleteState();
            }

            if (this.config.features.farmer && this.startAutoSellInterval) {
                if (this.autoSellTimer) clearInterval(this.autoSellTimer);
                this.autoSellTimer = this.startAutoSellInterval();
            }
        });

        if (this.config.features.farmer) {
            this.bot.on('chat', (u, m) => { if(this.handleSellGUI) this.handleSellGUI(u, m); });
        }
        
        this.bot.on('physicTick', () => {
            if (this.bot && this.bot.entity && !this.isPausedForEating && !this.isBusy() && !this.bot.isEating) this.checkAndEat(false);
        });
        
        this.bot.on('blockUpdate', (oldBlock, newBlock) => {
            if (oldBlock.name === 'air' && newBlock.name !== 'air') {
                const blockPos = newBlock.position.floored(); 
                const botCurrentPos = this.bot.entity ? this.bot.entity.position.floored() : null;
                if (!botCurrentPos) return; 
            }
        });
        
        this.bot.on('message', (m) => { console.log(`[${this.config.username}] ${m.toString()}`); });
        this.bot.on('kicked', (r) => { console.log(`Atıldı: ${r}`); this.cleanupAndSave(); setTimeout(() => this.start(), 5000); });
        this.bot.on('end', (r) => { console.log(`Koptu: ${r}`); this.cleanupAndSave(); setTimeout(() => this.start(), 5000); });
        this.bot.on('error', (e) => console.error(`Hata:`, e));
    }
 
    cleanupAndSave() {
        if (this.bot && this.bot.pathfinder) this.bot.pathfinder.stop();
        if (this.autoSellTimer) clearInterval(this.autoSellTimer);
        if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
        if (this.armorCheckTimer) clearInterval(this.armorCheckTimer);
        
        if (this.modCheckInterval) clearInterval(this.modCheckInterval);
        
        this.isPatrolling = false;
        if (this.bot) this.bot.removeAllListeners();
        this.saveState();
        this.isExcavating = false; this.isBuilding = false; this.isSelling = false; this.isTossing = false; this.isFollowing = false;
        this.excavationState = null; this.cactusState = null; this.patrolState = null; 
        this.bot = null; 
    }

    saveState() {
        let state = null;
        if (this.excavationState) state = this.excavationState;
        else if (this.cactusState) state = this.cactusState;
        else if (this.patrolState) state = this.patrolState; 
		else if (this.builder && this.builder.active) state = this.builder.getState();
        if (!state) return;
        try { fs.writeFileSync(this.config.stateFileName, JSON.stringify(state, null, 2)); } catch (e) {}
    }

    loadState() {
        const path = this.config.stateFileName;
        if (!fs.existsSync(path)) return null;
        try { return JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { return null; }
    }
    
    deleteState() {
        this.excavationState = null; this.cactusState = null; this.patrolState = null;
        if (fs.existsSync(this.config.stateFileName)) { try { fs.unlinkSync(this.config.stateFileName); } catch (e) {} }
    }

    // --- GÜVENLİK FONKSİYONLARI ---
    checkSecurity() {
        if (!this.bot || !this.bot.players) return;

        for (const playerName in this.bot.players) {
            if (playerName === this.bot.username) continue; 

            const player = this.bot.players[playerName];

            if (player && player.entity) {
                if (this.runFromEveryone) {
                    if (!this.whitelist.includes(playerName)) {
                        console.error(`[ALARM] PARANOID MOD: YABANCI TESPİT EDİLDİ (${playerName})! KAÇILIYOR!`);
                        this.bot.quit(`Guvenlik: Yabanci (${playerName})`);
                        return;
                    }
                } 
                else {
                    if (this.moderatorList.includes(playerName)) {
                        console.error(`[ALARM] MODERATOR TESPİT EDİLDİ (${playerName})! KAÇILIYOR!`);
                        this.bot.quit(`Guvenlik: Yasakli (${playerName})`);
                        return;
                    }
                }
            }
        }
    }

    toggleParanoidMode(isActive) {
        this.runFromEveryone = (isActive === 'true' || isActive === true);
        console.log(`[Güvenlik] Herkesden Kaç Modu: ${this.runFromEveryone ? 'AÇIK' : 'KAPALI'}`);
        return this.runFromEveryone;
    }

    addModerator(u) { if (!this.moderatorList.includes(u)) this.moderatorList.push(u); return this.moderatorList; }
    removeModerator(u) { this.moderatorList = this.moderatorList.filter(n => n !== u); return this.moderatorList; }
    getModerators() { return this.moderatorList; }
    
    addWhitelist(u) { if (!this.whitelist.includes(u)) this.whitelist.push(u); return this.whitelist; }
    removeWhitelist(u) { this.whitelist = this.whitelist.filter(n => n !== u); return this.whitelist; }
    getWhitelist() { return this.whitelist; }

    // --- ENVANTER ETKİLEŞİMİ ---
    async inventoryAction(slotId, actionType) {
        if (!this.bot) throw new Error("Bot bağlı değil.");
        
        const slot = parseInt(slotId);
        if (isNaN(slot)) throw new Error("Geçersiz slot numarası.");

        const item = this.bot.inventory.slots[slot];

        if (actionType === 'left') {
            await this.bot.clickWindow(slot, 0, 0);
            return `Slot ${slot} sol tıklandı.`;
        } 
        else if (actionType === 'right') {
            await this.bot.clickWindow(slot, 1, 0);
            return `Slot ${slot} sağ tıklandı.`;
        }
        else if (actionType === 'drop') {
            if (!item) throw new Error("Bu slot zaten boş, atılacak bir şey yok.");
            await this.bot.tossStack(item);
            return `Slot ${slot} yere atıldı.`;
        }
        else {
            throw new Error("Geçersiz işlem tipi.");
        }
    }


    startControlState(control, state) {
        if (!this.bot) return;
        this.bot.setControlState(control, state);
    }

    // İstediğin Slottaki Eşyayı Elimize Alma
    async equipItemFromSlot(slotId) {
        if (!this.bot) throw new Error("Bot bağlı değil.");
        const slot = parseInt(slotId);
        
        const item = this.bot.inventory.slots[slot];
        if (!item) throw new Error(`Slot ${slot} boş, alınacak eşya yok.`);

        try {
            await this.bot.equip(item, 'hand'); 
            return `Slot ${slot} eline alındı.`;
        } catch (e) {
            throw new Error(`Eşya eline alınırken hata oluştu: ${e.message}`);
        }
    }

    // Belirli bir süre hareket et ve dur
    async moveTimed(control, duration) {
        if (!this.bot) return "Bot yok.";
        
        if (this.isBusy() && !this.isPausedForEating) return "Bot şu an bir görev yapıyor.";

        this.bot.setControlState(control, true);
        await new Promise(resolve => setTimeout(resolve, duration));
        this.bot.setControlState(control, false);
        return `${control} yönüne ${duration}ms hareket edildi.`;
    }

    // Tıklama İşlemleri (Sol/Sağ Tık)
    async performClick(type) {
        if (!this.bot || this.isBusy()) return "Meşgul.";

        const block = this.bot.blockAtCursor(4);

        if (type === 'left') {
            this.bot.swingArm(); 
            if (block) {
                try {
                    await this.bot.dig(block, 'ignore', 'raycast'); 
                    return "Blok kazıldı.";
                } catch (e) {
                    return "Kazılamadı (Çok sert veya hata).";
                }
            }
            return "Havaya vuruldu.";
        } 
        else if (type === 'right') {
            if (block) {
                try {
                    if (this.bot.heldItem) {
                        await this.bot.placeBlock(block, new vec3(0, 1, 0));
                        return "Blok koyuldu.";
                    }
                } catch (e) {
                    try {
                        await this.bot.activateBlock(block);
                        return "Blok kullanıldı.";
                    } catch (e2) {}
                }
            }
            
            try {
                this.bot.activateItem();
                return "Eşya kullanıldı.";
            } catch(e) { return "İşlem başarısız."; }
        }
    }

    // Hotbar Yuvasını Seçme
    selectHotbarSlot(slotIndex) {
        if (!this.bot) throw new Error("Bot bağlı değil.");
        
        slotIndex = parseInt(slotIndex);
        if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 8) {
            throw new Error("Geçersiz hotbar indeksi (0-8 arası olmalı).");
        }
        
        this.bot.setQuickBarSlot(slotIndex);
        return `${slotIndex} numaralı hotbar yuvası seçildi.`;
    }

    // Joystick verisine göre bakış açısını güncelle
    lookUpdate(yawDelta, pitchDelta) {
        if (!this.bot || !this.bot.entity) return;
        
        const currentYaw = this.bot.entity.yaw;
        const currentPitch = this.bot.entity.pitch;

        this.bot.look(currentYaw + yawDelta, currentPitch + pitchDelta);
    }

    // Stop Functions
    stopPatrolTask() {
        if (!this.isPatrolling && !this.patrolState) return "Bot zaten devriye gezmiyor.";
        this.deleteState(); this.patrolState = null; this.isPatrolling = false;
        if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
        if(this.bot) this.bot.pathfinder.stop();
        return "Devriye durduruldu.";
    }
	
	stopSchematicTask() { if(this.builder) this.builder.stop(); return "İnşaat durduruldu."; }
    
    stopExcavateTask() { if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer); this.deleteState(); this.isExcavating = false; if(this.bot) this.bot.pathfinder.stop(); return "Durduruldu."; }
    stopCactusTask() { if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer); this.deleteState(); this.isBuilding = false; if(this.bot) this.bot.pathfinder.stop(); return "Durduruldu."; }
    
    // Other
    testKick() { if (this.bot) { this.bot.quit('Test Kick'); return 'Atılıyor...'; } return 'Bağlı değil.'; }
    async tossInventory(c) { if (this.isBusy()) throw new Error("Meşgul."); this.isTossing = true; try { await this.tossInventoryItems(c); } finally { this.isTossing = false; } }
    startFollow(u) { if (!this.bot) throw new Error("Bağlı değil."); if (this.isBusy()) throw new Error("Meşgul."); const p = this.bot.players[u]; if (!p || !p.entity) throw new Error("Oyuncu yok."); this.isFollowing = true; this.followTarget = p.entity; this.bot.pathfinder.setGoal(new GoalFollow(p.entity, 3), true); }
    stopFollow() { this.isFollowing = false; this.followTarget = null; if(this.bot) this.bot.pathfinder.stop(); return "Bırakıldı."; }

    getStatus() {
        if (!this.bot) return { status: 'Başlatılıyor', message: 'Bağlanıyor...' };
        if (this.resumeCheckTimer) return { status: 'Beklemede', message: 'Alan bekleniyor...' };
        if (this.isPatrolling) return { status: 'Meşgul', message: 'Devriye...' };
        if (this.isBuilding) return { status: 'Meşgul', message: 'İnşaat...' };
        if (this.isExcavating) return { status: 'Meşgul', message: 'Kazı...' };
        if (this.isFollowing) return { status: 'Meşgul', message: 'Takip...' };
        if (this.isTossing) return { status: 'Meşgul', message: 'Boşaltılıyor...' };
        if (!this.bot.entity) return { status: 'Başlatılıyor', message: 'Sunucu...' };
        
        let msg = 'Hazır.';
        if (this.runFromEveryone) msg += ' (PARANOID MOD AÇIK)';
        
        return { status: 'Boşta', message: msg };
    }
}

module.exports = BotInstance;