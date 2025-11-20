const fs = require('fs');
const path = require('path');
const vec3 = require('vec3');
const { Movements, goals } = require('mineflayer-pathfinder');

// --- KÜTÜPHANE KONTROLÜ ---
let Schematic, mcDataLib;
try {
    const lib = require('prismarine-schematic');
    Schematic = lib.Schematic || lib;
    mcDataLib = require('minecraft-data');
} catch (e) {
    console.error("!!! HATA: Kütüphaneler eksik !!!");
}

class SchematicBuilder {
    constructor(botInstance) {
        this.botInstance = botInstance;
        this.bot = botInstance.bot;
        this.config = botInstance.config;
        this.active = false;
        
        // State Değişkenleri
        this.fileName = null;
        this.origin = null;
        this.chestPos = null;
        this.area = null; // Metadata için
        
        this.buildQueue = [];
        this.skippedQueue = []; 
        this.temporaryBlocks = []; 
        
        this.progressIndex = 0; // Kaçıncı blokta kaldığımızı tutar
        
        this.scaffoldingPriority = ['dirt', 'cobblestone', 'stone', 'netherrack', 'andesite', 'granite'];
    }

    setupMovements() {
        if(!this.bot.pathfinder) return;
        const mcData = require('minecraft-data')(this.bot.version);
        const moves = new Movements(this.bot, mcData);
        
        moves.canDig = false; 
        moves.placeCost = 2;
        moves.maxDropDown = 100; 
        this.bot.pathfinder.setMovements(moves);
    }

    async stopMoving() {
        if (this.bot.pathfinder) this.bot.pathfinder.setGoal(null);
        this.bot.clearControlStates();
    }

    // --- STATE GETİRME (KAYDETME İÇİN) ---
    getState() {
        return {
            task: 'schematic_build', // Ana task adı
            fileName: this.fileName,
            origin: { x: this.origin.x, y: this.origin.y, z: this.origin.z },
            chestPos: this.chestPos ? { x: this.chestPos.x, y: this.chestPos.y, z: this.chestPos.z } : null,
            area: this.area,
            temporaryBlocks: this.temporaryBlocks,
            progressIndex: this.progressIndex // En önemli kısım: Kaçıncı blokta kaldık
        };
    }

    // --- RESUME (YENİDEN BAŞLATMA) ---
    async resume(state) {
        console.log("[Mimar] 💾 Kayıtlı görev bulundu, yükleniyor...");
        
        this.fileName = state.fileName;
        this.origin = vec3(state.origin.x, state.origin.y, state.origin.z);
        this.chestPos = state.chestPos ? vec3(state.chestPos.x, state.chestPos.y, state.chestPos.z) : null;
        this.area = state.area;
        this.temporaryBlocks = state.temporaryBlocks.map(p => vec3(p.x, p.y, p.z));
        this.active = true;
        this.botInstance.isBuilding = true;

        // Queue'yu oluştur ama kaldığı yere sar
        await this.prepareBuildQueue(state.progressIndex);
        
        // İnşaat veya Bekleme döngüsünü başlat
        await this.startExecutionLoop();
    }



// --- START (SIFIRDAN BAŞLATMA) ---
    async start(options) {
        const { fileName, chestCoords, area } = options;
        
        this.fileName = fileName;
        this.area = area;
        this.chestPos = vec3(chestCoords.x, chestCoords.y, chestCoords.z);
        
        // Şematiği oku (Boyutları lazım)
        const filePath = path.join(__dirname, 'schematics', fileName);
        const version = this.config.version || "1.16.5";
        const buffer = fs.readFileSync(filePath);
        let schematic;
        try { schematic = await Schematic.read(buffer, version); } 
        catch (e) { schematic = await Schematic.read(buffer); }
        
        const startX = Math.floor((area.minX + area.maxX) / 2 - (schematic.size.x / 2));
        const startZ = Math.floor((area.minZ + area.maxZ) / 2 - (schematic.size.z / 2));
        
        // --- ZEMİN AYARI (FIX) ---
        // Botun ayak bastığı yer
        let startY = Math.floor(this.bot.entity.position.y); 
        
        // KONTROL: Eğer bot sandıktan 2 blok veya daha yüksekteyse (Çatıdaysa/İskeledeyse)
        // Botun konumunu değil, SANDIĞIN konumunu zemin kabul et.
        if (startY > chestCoords.y + 1) {
            console.log(`[Mimar] ⚠️ Bot sandıktan yüksekte (Bot Y:${startY} > Sandık Y:${chestCoords.y}).`);
            console.log(`[Mimar] ⬇️ Çatıda olduğun varsayılarak Zemin Kat = Sandık Seviyesi (${chestCoords.y}) olarak ayarlandı.`);
            startY = Math.floor(chestCoords.y);
        } else {
            // Eğer sandıkla aynı seviyedeyse veya aşağıdaysa kendi konumunu kullan
            console.log(`[Mimar] ✅ Zemin kat botun durduğu yer olarak ayarlandı (Y:${startY}).`);
        }
        // -------------------------

        this.origin = vec3(startX, startY, startZ);

        this.active = true;
        this.botInstance.isBuilding = true;
        this.temporaryBlocks = []; 
        this.skippedQueue = []; 
        this.progressIndex = 0; // Sıfırdan başlıyoruz

        console.log(`[Mimar] Görev başlatılıyor... Origin: ${this.origin}`);
        
        await this.prepareBuildQueue(0);
        await this.startExecutionLoop();
    }








    // --- BUILD QUEUE HAZIRLAMA ---
    async prepareBuildQueue(skipCount = 0) {
        const filePath = path.join(__dirname, 'schematics', this.fileName);
        const version = this.config.version || "1.16.5";
        const buffer = fs.readFileSync(filePath);
        let schematic;
        try { schematic = await Schematic.read(buffer, version); } 
        catch (e) { schematic = await Schematic.read(buffer); }

        const mcData = mcDataLib(this.bot.version);
        const size = schematic.size;
        
        this.buildQueue = [];
        const cursor = vec3(0, 0, 0);

        for (cursor.y = 0; cursor.y < size.y; cursor.y++) {
            for (cursor.x = 0; cursor.x < size.x; cursor.x++) {
                for (cursor.z = 0; cursor.z < size.z; cursor.z++) {
                    try {
                        const blockState = schematic.getBlock(cursor);
                        let blockName = null;
                        let properties = {}; 
                        if (blockState) {
                            if (blockState.name) blockName = blockState.name;
                            if (blockState.getProperties) properties = blockState.getProperties();
                            else if (blockState.properties) properties = blockState.properties;
                            if (!blockName && blockState.type !== undefined && mcData.blocks[blockState.type]) blockName = mcData.blocks[blockState.type].name;
                        }
                        if (blockName && blockName.includes(':')) blockName = blockName.split(':')[1];
                        if (blockName && blockName !== 'air' && blockName !== 'void_air' && blockName !== 'cave_air') {
                            this.buildQueue.push({
                                relPos: cursor.clone(),
                                worldPos: this.origin.plus(cursor),
                                name: blockName,
                                props: properties 
                            });
                        }
                    } catch (e) {}
                }
            }
        }
        
        // SIRALAMA ÇOK ÖNEMLİ (Her zaman aynı sırada olmalı ki index tutsun)
        this.buildQueue.sort((a, b) => a.relPos.y - b.relPos.y);
        
        console.log(`[Mimar] Toplam Blok: ${this.buildQueue.length}, Atlanacak: ${skipCount}`);
        
        // Kaldığımız yere kadar olanları sil (Splice)
        if (skipCount > 0) {
            if (skipCount >= this.buildQueue.length) {
                console.log("[Mimar] Bu şematik zaten bitmiş görünüyor. Sadece kontroller yapılacak.");
                this.buildQueue = [];
            } else {
                this.buildQueue.splice(0, skipCount);
                // Progress index'i güncelle ki save alırken doğru kalsın
                this.progressIndex = skipCount; 
            }
        } else {
            this.progressIndex = 0;
        }
    }

    // --- AKILLI BAŞLATMA DÖNGÜSÜ (MESAFE KONTROLÜ) ---
    async startExecutionLoop() {
        const SAFE_DISTANCE = 200;

        while (this.active) {
            if (!this.bot.entity) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            const dist = this.bot.entity.position.distanceTo(this.origin);
            
            if (dist > SAFE_DISTANCE) {
                console.log(`[Mimar] ⚠️ Bölgeden çok uzak (${Math.floor(dist)}m). İnşaat için yaklaşmanız bekleniyor...`);
                // Kullanıcı manuel olarak durdurana kadar bekle
                await new Promise(r => setTimeout(r, 5000));
            } else {
                console.log(`[Mimar] ✅ Bölgeye yakın (${Math.floor(dist)}m). İnşaat başlıyor/devam ediyor.`);
                this.setupMovements(); // Hareketleri ayarla
                await this.buildLoop(); // Ana inşaat döngüsüne gir
                
                // buildLoop bittiğinde; ya bittiği için ya da hata olduğu için çıkar.
                // Eğer queue boşsa bitmiştir.
                if (this.buildQueue.length === 0 && this.skippedQueue.length === 0) {
                    console.log("[Mimar] İnşaat bitti! İskeleler temizleniyor...");
                    await this.cleanupScaffolding();
                    return; // Çıkış
                }
            }
        }
    }

    // --- ANA DÖNGÜ (BUILD LOOP) ---



async buildLoop() {
        let consecutiveFails = 0;
        const MAX_FAILS_BEFORE_SKIP = 5; 

        console.log("[Mimar] Mod: Kalanları Tamamla (Dolu yerler ellenmeyecek).");

        while (this.active && this.buildQueue.length > 0) {
            const target = this.buildQueue[0]; 
            
            // 1. Chunk Yüklenmemişse Kontrolü
            const currentBlock = this.bot.blockAt(target.worldPos);
            if (!currentBlock) {
                if (this.buildQueue.length % 50 === 0) console.log(`[Mimar] 🔭 Chunk yüklenmemiş, yaklaşıyorum...`);
                try { await this.bot.pathfinder.goto(new goals.GoalNear(target.worldPos.x, target.worldPos.y, target.worldPos.z, 4)); } catch(e) {}
                continue; 
            }

            // --- 🔥 YENİ MANTIK: DOLU MU BOŞ MU? 🔥 ---
            
            // Hedef blok (Schematic'teki) hava değilse (yani bir şey koyacaksak)
            if (target.name !== 'air' && target.name !== 'void_air') {
                
                // Dünyadaki blok KATI bir bloksa (Hava, su veya lav değilse)
                // İsmine bakmaksızın "Burada bir şey var, demek ki yapılmış" kabul et.
                if (currentBlock.boundingBox === 'block') {
                    this.buildQueue.shift(); // Listeden sil geç
					this.progressIndex++;
                    
                    // Hızlı geçiş logu (Her 200 blokta bir)
                    if (this.buildQueue.length % 200 === 0) {
                        console.log(`[Mimar] ⏩ Dolu yerler geçiliyor... (Kalan: ${this.buildQueue.length})`);
                    }
                    consecutiveFails = 0;
                    continue; 
                }
            } 
            // Eğer Schematic'te hava varsa ve dünyada da hava varsa, onu da geç
            else if (currentBlock.boundingBox === 'empty') {
                this.buildQueue.shift();
				this.progressIndex++;
                continue;
            }

            // --- BURAYA GELDİYSEK ORASI BOŞTUR VE DOLDURULMALIDIR ---

            await this.botInstance.checkAndEat(true);

            // MALZEME KONTROLÜ
            if (this.countItemInInventory(target.name) === 0) {
                console.log(`[Mimar] Malzeme bitti: ${target.name}. Sandıktan tedarik edilecek...`);
                await this.restockFromChest(target.name);
                this.setupMovements();
                if (!this.active) break;
                continue;
            }

            try {
                const botPos = this.bot.entity.position;
                const dist = botPos.distanceTo(target.worldPos);
                
                // Uzaklık Koruması
                if (botPos.distanceTo(this.origin) > 200) {
                    console.log("[Mimar] Bölgeden uzaklaşıldı! Beklemeye geçiliyor.");
                    return; 
                }

                const ref = this.findReferenceBlock(target.worldPos);
                
                if (!ref) {
                    const smartSupport = this.findSchematicSupport(target);
                    if (smartSupport) {
                        // Destek bloğunu öne al
                        this.moveToFront(smartSupport);
                        continue;
                    } else {
                        // Destek yoksa ertele
                        const postponed = this.buildQueue.shift();
                        this.buildQueue.push(postponed);
                        consecutiveFails++;
                        if (consecutiveFails > 20) {
                            await this.repositionSmartly(target.worldPos);
                            consecutiveFails = 0;
                        }
                        continue;
                    }
                }

                if (dist > 4.5) await this.smartMove(target.worldPos);

                const botFloor = botPos.floored();
                if (botFloor.equals(target.worldPos) || botFloor.offset(0, 1, 0).equals(target.worldPos)) {
                     if (target.worldPos.y > botPos.y) await this.towerUp(1);
                     else await this.repositionSmartly(target.worldPos); 
                }

                // KOYMA İŞLEMİ
                const placeResult = await this.attemptPlace(target, ref);
                
                if (placeResult === 'success') {
                    this.buildQueue.shift();
                    this.progressIndex++; 
                    consecutiveFails = 0;
                    await this.botInstance.randDelay(150, 300);
                } 
                else if (placeResult === 'out_of_reach' || placeResult === 'failed') {
                    console.log(`[Mimar] Erişim hatası. Konum değiştiriliyor...`);
                    await this.repositionSmartly(target.worldPos);
                    consecutiveFails++;
                }
                
                if (consecutiveFails > MAX_FAILS_BEFORE_SKIP) {
                    // Sadece konsolu kirletmesin diye logu kaldırdım veya azalttım
                    this.skippedQueue.push(target); 
                    this.buildQueue.shift();
                    consecutiveFails = 0;
                    await this.stepAside(); 
                }

            } catch (e) {
                console.log("Build hatası:", e.message);
                await this.botInstance.randDelay(500, 1000);
            }
        }

        if (this.active && this.skippedQueue.length > 0) {
            console.log(`[Mimar] 🔄 Atlanan bloklar deneniyor...`);
            this.buildQueue = this.skippedQueue; 
            this.skippedQueue = []; 
            await this.buildLoop(); 
        }
    }




    // --- ANALİZ (DEĞİŞMEDİ) ---
    async analyzeSchematic(fileName) {
        const filePath = path.join(__dirname, 'schematics', fileName);
        const version = this.config.version || "1.16.5";
        if (!fs.existsSync(filePath)) throw new Error("Dosya bulunamadı: " + fileName);
        const buffer = fs.readFileSync(filePath);
        let schematic;
        try { schematic = await Schematic.read(buffer, version); } 
        catch (e) { schematic = await Schematic.read(buffer); }
        const mcData = mcDataLib(version);
        const materialCount = {};
        const size = schematic.size;
        const cursor = vec3(0, 0, 0);
        for (cursor.y = 0; cursor.y < size.y; cursor.y++) {
            for (cursor.x = 0; cursor.x < size.x; cursor.x++) {
                for (cursor.z = 0; cursor.z < size.z; cursor.z++) {
                    try {
                        const blockState = schematic.getBlock(cursor);
                        let blockName = null;
                        if (blockState) {
                            if (blockState.name) blockName = blockState.name;
                            if (!blockName && blockState.type !== undefined && mcData.blocks[blockState.type]) blockName = mcData.blocks[blockState.type].name;
                        }
                        if (blockName && blockName.includes(':')) blockName = blockName.split(':')[1];
                        if (blockName && blockName !== 'air' && blockName !== 'void_air' && blockName !== 'cave_air') {
                            if (!materialCount[blockName]) materialCount[blockName] = 0;
                            materialCount[blockName]++;
                        }
                    } catch (e) {}
                }
            }
        }
        return { size: schematic.size, materials: materialCount };
    }



async repositionSmartly(targetBlockPos) {
        const botPos = this.bot.entity.position.floored();
        const candidates = [];

        const range = 4; 
        for (let x = -range; x <= range; x++) {
            for (let z = -range; z <= range; z++) {
                for (let y = -1; y <= 2; y++) { 
                    const checkPos = botPos.offset(x, y, z);
                    
                    // --- YENİ KURAL: HEDEF KONUM KONTROLLERİ ---
                    if (checkPos.equals(targetBlockPos)) continue;
                    
                    // 1. Sandığa çok yakınsa o konumu ASLA seçme
                    if (this.chestPos && checkPos.distanceTo(this.chestPos) < 3.5) continue; 
                    // ---------------------------------------------

                    const blockBelow = this.bot.blockAt(checkPos.offset(0, -1, 0));
                    const feet = this.bot.blockAt(checkPos);
                    const head = this.bot.blockAt(checkPos.offset(0, 1, 0));

                    if (blockBelow && blockBelow.boundingBox === 'block' && 
                        feet && feet.boundingBox === 'empty' && 
                        head && head.boundingBox === 'empty') {

                        const distToTarget = checkPos.distanceTo(targetBlockPos);
                        // Çok uzaklaşmasın ama çok da dibine girmesin
                        if (distToTarget <= 5.5 && distToTarget >= 1.5) {
                            candidates.push(checkPos);
                        }
                    }
                }
            }
        }

        // En yükseği ve en yakını seç
        candidates.sort((a, b) => {
            if (b.y !== a.y) return b.y - a.y; 
            return this.bot.entity.position.distanceTo(a) - this.bot.entity.position.distanceTo(b);
        });

        if (candidates.length > 0) {
            const bestSpot = candidates[0];
            console.log(`[Mimar] 🧗 Parkur -> ${bestSpot}`);
            const goal = new goals.GoalNear(bestSpot.x, bestSpot.y, bestSpot.z, 0.5);
            try {
                await this.bot.pathfinder.goto(goal);
                return;
            } catch (e) {}
        }

        console.log("[Mimar] Konum bulunamadı, olduğum yerde yükseliyorum.");
        await this.towerUp(1);
    }






    async towerUp(height) {
        if(height <= 0) return;
        if (this.chestPos && this.bot.entity.position.distanceTo(this.chestPos) < 3) {
            console.log("⚠️ [Mimar] Sandık çok yakın! Uzaklaşmaya çalışıyorum...");
            await this.retreatFromChest();
            return;
        }
        const scaffoldItem = this.getScaffoldingItem();
        if (!scaffoldItem) { console.log("[Mimar] Yükselemiyorum: Malzeme yok!"); return; }
        for (let i = 0; i < height; i++) {
            await this.stopMoving();
            const myPos = this.bot.entity.position.floored();
            try {
                await this.jumpAndPlace(scaffoldItem.name);
                this.temporaryBlocks.push(myPos.offset(0, -1, 0)); 
            } catch (e) { break; }
            await this.botInstance.randDelay(100, 200);
        }
    }

    async jumpAndPlace(itemName) {
        let moveListener = null;
        let timeoutHandle = null;
        const cleanup = () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            if (this.bot) {
                this.bot.setControlState('jump', false);
                if (moveListener) this.bot.removeListener('move', moveListener);
            }
        };
        try {
            const item = this.bot.inventory.items().find(i => i.name === itemName);
            if (!item) throw new Error(`Envanterde ${itemName} yok!`);
            await this.bot.equip(item, "hand");
            const botPos = this.bot.entity.position.floored();
            const referenceBlock = this.bot.blockAt(botPos.offset(0, -1, 0));
            if (!referenceBlock) throw new Error("Referans blok yok.");
            const centerPos = botPos.offset(0.5, 0, 0.5);
            await this.bot.lookAt(centerPos.offset(0, -1, 0), true); 
            const jumpY = Math.floor(this.bot.entity.position.y) + 1.0;
            await new Promise((resolve, reject) => {
                let tried = false;
                moveListener = async () => {
                    if (!this.bot || !this.bot.entity) return;
                    if (this.bot.entity.position.y > jumpY && !tried) {
                        try { tried = true; await this.bot.placeBlock(referenceBlock, vec3(0, 1, 0)); resolve(); } catch (err) { tried = false; }
                    }
                };
                timeoutHandle = setTimeout(() => { reject(new Error("Zıplama zaman aşımı.")); }, 3000);
                this.bot.setControlState('jump', true);
                this.bot.on('move', moveListener);
            });
            cleanup();
        } catch (error) { cleanup(); throw error; }
    }

    getScaffoldingItem() {
        const inv = this.bot.inventory.items();
        for (const priorityName of this.scaffoldingPriority) {
            const item = inv.find(i => i.name.includes(priorityName));
            if (item) return item;
        }
        return null;
    }

    moveToFront(blockData) {
        const index = this.buildQueue.indexOf(blockData);
        if (index > -1) {
            this.buildQueue.splice(index, 1);
            this.buildQueue.unshift(blockData);
        }
    }

    findReferenceBlock(pos) {
        const faces = [vec3(0, -1, 0), vec3(0, 1, 0), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 0, -1)];
        for (const face of faces) {
            const refPos = pos.plus(face);
            const block = this.bot.blockAt(refPos);
            if (block && block.name !== 'air' && block.name !== 'void_air' && block.boundingBox !== 'empty') {
                return { block, face: face.scaled(-1) };
            }
        }
        return null;
    }

    findSchematicSupport(targetBlock) {
        const directions = [vec3(0, -1, 0), vec3(0, 1, 0), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 0, -1)];
        for (const dir of directions) {
            const neighborPos = targetBlock.worldPos.plus(dir);
            const neighborInQueue = this.buildQueue.find(b => b.worldPos.equals(neighborPos));
            if (neighborInQueue) {
                const neighborHasSupport = this.findReferenceBlock(neighborInQueue.worldPos);
                if (neighborHasSupport) return neighborInQueue;
            }
        }
        return null;
    }

    isPositionReserved(pos) { return this.buildQueue.some(b => b.worldPos.equals(pos)); }

    async smartMove(targetPos) {
        const botPos = this.bot.entity.position;
        const dist = botPos.distanceTo(targetPos);
        if (dist > 5) {
            if (targetPos.y > botPos.y + 1) await this.repositionSmartly(targetPos);
            else {
                let goalX = targetPos.x;
                let goalZ = targetPos.z;
                if (this.isPositionReserved(targetPos.floored())) goalX += 1; 
                const goal = new goals.GoalNear(goalX, targetPos.y, goalZ, 2);
                await this.bot.pathfinder.goto(goal).catch(()=>{});
            }
        }
    }
    
    async stepBack(targetPos) {
        if (targetPos) await this.bot.lookAt(targetPos);
        this.bot.setControlState('sneak', true);
        this.bot.setControlState('back', true);
        await this.botInstance.randDelay(600, 1000);
        this.bot.clearControlStates();
    }
    
    async stepAside() {
        this.bot.setControlState('right', true);
        await this.botInstance.randDelay(400, 600);
        this.bot.clearControlStates();
    }

    async breakObstacle(block) {
        if (!block || block.name === 'air') return;
        await this.bot.tool.equipForBlock(block, {}); 
        await this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5));
        this.bot.swingArm();
        try { await this.bot.dig(block); this.temporaryBlocks = this.temporaryBlocks.filter(p => !p.equals(block.position)); } catch (e) {}
    }


//HATALIFONKSİYON BAŞ










async attemptPlace(target, ref) {
    const blockAtTarget = this.bot.blockAt(target.worldPos);
    if (blockAtTarget && blockAtTarget.name !== 'air' && blockAtTarget.name !== 'water') {
        if (blockAtTarget.name === target.name) return 'success';
        if (blockAtTarget.boundingBox !== 'empty') await this.breakObstacle(blockAtTarget);
    }

    const item = this.bot.inventory.items().find(i => i.name === target.name);
    if (!item) return 'missing_item';
    await this.bot.equip(item, 'hand');

    let delta = vec3(0.5, 0.5, 0.5);

    const isDirectional = target.name.includes('stairs') ||
                          target.name.includes('piston') ||
                          target.name.includes('observer') ||
                          target.name.includes('chest') ||
                          target.name.includes('furnace') ||
                          target.name.includes('gate');

    if (isDirectional) {
        const wanted = target.props.facing || 'north';
        const yawMap = { north: 0, south: Math.PI, west: Math.PI / 2, east: -Math.PI / 2 };
        const yaw = yawMap[wanted];

        if (target.props.half === 'top') delta.y = 0.9;
        else if (target.props.half === 'bottom') delta.y = 0.1;

        await this.bot.look(yaw, 0, true);
        await new Promise(r => setTimeout(r, 50));

        const originalLookAt = this.bot.lookAt;
        this.bot.lookAt = () => Promise.resolve();

        try { await this.bot.placeBlock(ref.block, ref.face, delta); }
        catch (e) { /* mute */ }
        finally { this.bot.lookAt = originalLookAt; }

        this.lastPlacedPos = target.worldPos.clone();
        return 'success';
    }

    await this.bot.lookAt(ref.block.position.offset(0.5, 0.5, 0.5), true);
    try { await this.bot.placeBlock(ref.block, ref.face, delta); }
    catch (e) { return 'failed'; }

    this.lastPlacedPos = target.worldPos.clone();
    return 'success';
}















//HATALI FONKSİYON

    async cleanupScaffolding() {
        if (this.temporaryBlocks.length === 0) { this.stop(); return; }
        const toRemove = [...this.temporaryBlocks].reverse();
        const uniqueRemove = [];
        const seen = new Set();
        for(const pos of toRemove) {
            const key = pos.toString();
            if(!seen.has(key)) { seen.add(key); uniqueRemove.push(pos); }
        }
        for (const pos of uniqueRemove) {
            const block = this.bot.blockAt(pos);
            if (block && block.name !== 'air') {
                if (this.bot.entity.position.distanceTo(pos) > 5) await this.bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 4));
                await this.breakObstacle(block);
            }
        }
        this.temporaryBlocks = [];
        this.stop();
    }

    countItemInInventory(name) {
        if(!this.bot.inventory) return 0;
        return this.bot.inventory.items().filter(i => i.name === name).reduce((a, b) => a + b.count, 0);
    }




async retreatFromChest() {
        console.log("[Mimar] Sandık bölgesinden güvenli alana çekiliniyor...");
        
        const mcData = require('minecraft-data')(this.bot.version);
        const escapeMovements = new Movements(this.bot, mcData);

        escapeMovements.canDig = false;
        escapeMovements.placeCost = 10000; 
        escapeMovements.scafoldingBlocks = []; 

        this.bot.pathfinder.setMovements(escapeMovements);

        // --- YENİ KAÇIŞ MANTIĞI ---
        // 4 farklı kaçış noktası dene (Sandıktan 3 blok ötesi)
        const escapeOffsets = [
            vec3(3, 0, 0),  // Doğu
            vec3(-3, 0, 0), // Batı
            vec3(0, 0, 3),  // Güney
            vec3(0, 0, -3), // Kuzey
            vec3(2, 0, 2),  // Çaprazlar (Yedek)
            vec3(-2, 0, -2)
        ];

        let bestEscape = null;

        // Boş olan ilk kaçış noktasını bul
        for (const offset of escapeOffsets) {
            const target = this.chestPos.plus(offset);
            const blockFeet = this.bot.blockAt(target);
            const blockHead = this.bot.blockAt(target.offset(0, 1, 0));
            
            // Eğer ayak bastığı yer hava değilse (yani zemin yoksa) oraya gitmesin diye kontrol edebilirsin
            // Ama şimdilik sadece kafası sıkışmasın diye empty kontrolü yapalım
            if (blockFeet && blockFeet.boundingBox === 'empty' && blockHead && blockHead.boundingBox === 'empty') {
                bestEscape = target;
                break;
            }
        }

        // Hiçbiri boş değilse mecburen ilkini seç
        if (!bestEscape) bestEscape = this.chestPos.plus(escapeOffsets[0]);

        try {
            // Hedefe git
            await this.bot.pathfinder.goto(new goals.GoalNear(bestEscape.x, bestEscape.y, bestEscape.z, 1));
            console.log(`[Mimar] Güvenli mesafeye (${bestEscape}) ulaşıldı.`);
        } catch (e) {
            console.log("[Mimar] Tam uzaklaşılamadı, ama denendi.");
        }

        this.bot.pathfinder.setGoal(null);
        // Kaçtıktan sonra 1 saniye bekle ki nefes alsın
        await new Promise(r => setTimeout(r, 1000));
    }




async restockFromChest(itemName) {
        if (!this.chestPos) { this.stop(); return; }

        console.log(`[Mimar] Sandığa gidiliyor: ${itemName} aranıyor...`);
        
        // Sandığın yanına git
        try {
            await this.bot.pathfinder.goto(new goals.GoalNear(this.chestPos.x, this.chestPos.y, this.chestPos.z, 1));
        } catch (e) {
            console.log("[Mimar] Sandığa gidilemedi, tekrar deneniyor...");
        }

        while (this.active) {
            // 1. KONTROL: Zaten üzerimde var mı?
            if (this.countItemInInventory(itemName) > 0) {
                console.log(`[Mimar] ✅ Üzerimde ${itemName} zaten var. İşe dönülüyor.`);
                
                // --- İŞE DÖNME KODU (DİREKT BURADA) ---
                if (this.lastPlacedPos) {
                    console.log(`[Mimar] 🔙 Son çalışma noktasına (${this.lastPlacedPos}) dönülüyor...`);
                    try { await this.bot.pathfinder.goto(new goals.GoalNear(this.lastPlacedPos.x, this.lastPlacedPos.y, this.lastPlacedPos.z, 2)); } catch (e) {}
                } else {
                    console.log(`[Mimar] 🔙 Başlangıç noktasına dönülüyor...`);
                    try { await this.bot.pathfinder.goto(new goals.GoalNear(this.origin.x, this.origin.y, this.origin.z, 2)); } catch (e) {}
                }
                // ---------------------------------------
                return;
            }

            // 2. Sandığı aç
            const chestBlock = this.bot.blockAt(this.chestPos);
            if (!chestBlock) {
                console.log("[Mimar] Sandık bloğu yüklenmedi, bekleniyor...");
                await new Promise(r => setTimeout(r, 2000));
                continue;
            }
            
            let chest;
            try {
                chest = await this.bot.openContainer(chestBlock);
            } catch (e) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
            }

            // 3. KONTROL: Sandığı açınca lag düzeldi mi, item geldi mi?
            if (this.countItemInInventory(itemName) > 0) {
                try { await chest.close(); } catch (e) {}
                
                // --- İŞE DÖNME KODU ---
                if (this.lastPlacedPos) {
                    try { await this.bot.pathfinder.goto(new goals.GoalNear(this.lastPlacedPos.x, this.lastPlacedPos.y, this.lastPlacedPos.z, 2)); } catch (e) {}
                } else {
                    try { await this.bot.pathfinder.goto(new goals.GoalNear(this.origin.x, this.origin.y, this.origin.z, 2)); } catch (e) {}
                }
                return;
            }

            // 4. Sandıktan Çekme İşlemi
            const item = chest.containerItems().find(i => i.name === itemName);
            
            if (item) {
                console.log(`[Mimar] Sandıktan ${itemName} alınıyor...`);
                const initialCount = this.countItemInInventory(itemName);
                
                try {
                    await chest.withdraw(item.type, null, item.count);
                } catch (e) {
                    console.log(`[Mimar] Alma hatası: ${e.message}`);
                }

                // --- SABIRLI BEKLEME (SPAM ENGELLEYİCİ) ---
                let received = false;
                for(let i=0; i<10; i++) { // 3 saniye boyunca bekle
                    await new Promise(r => setTimeout(r, 300));
                    if (this.countItemInInventory(itemName) > initialCount) {
                        received = true;
                        break;
                    }
                }

                if (received) {
                    console.log(`[Mimar] ✅ Malzeme alındı.`);
                    try { await chest.close(); } catch (e) {}

                    // --- İŞE DÖNME KODU ---
                    if (this.lastPlacedPos) {
                        console.log(`[Mimar] 🔙 Son çalışma noktasına dönülüyor...`);
                        try { await this.bot.pathfinder.goto(new goals.GoalNear(this.lastPlacedPos.x, this.lastPlacedPos.y, this.lastPlacedPos.z, 2)); } catch (e) {}
                    } else {
                        console.log(`[Mimar] 🔙 Başlangıca dönülüyor...`);
                        try { await this.bot.pathfinder.goto(new goals.GoalNear(this.origin.x, this.origin.y, this.origin.z, 2)); } catch (e) {}
                    }
                    return; 
                } else {
                    console.log(`[Mimar] ⚠️ Sunucu gecikmesi: İtem henüz envantere düşmedi. Tekrar deneniyor...`);
                    try { await chest.close(); } catch (e) {}
                    await new Promise(r => setTimeout(r, 1000));
                }

            } else {
                console.log(`[Mimar] Sandıkta ${itemName} YOK! Bekleniyor...`);
                try { await chest.close(); } catch (e) {}
                await new Promise(r => setTimeout(r, 4000));
            }
        }
    }




    stop() {
        this.active = false;
        this.botInstance.isBuilding = false;
        this.stopMoving();
        this.botInstance.deleteState(); // Görev bittiği veya manuel durdurulduğu için state'i sil
    }
}

module.exports = SchematicBuilder;

// async attemptPlace(target, ref) {
//     const blockAtTarget = this.bot.blockAt(target.worldPos);
//     if (blockAtTarget && blockAtTarget.name !== 'air' && blockAtTarget.name !== 'water') {
//         if (blockAtTarget.name === target.name) return 'success';
//         if (blockAtTarget.boundingBox !== 'empty') await this.breakObstacle(blockAtTarget);
//     }
//
//     const item = this.bot.inventory.items().find(i => i.name === target.name);
//     if (!item) return 'missing_item';
//     await this.bot.equip(item, 'hand');
//
//     let delta = vec3(0.5, 0.5, 0.5);
//
//     const isDirectional = target.name.includes('stairs') ||
//                           target.name.includes('piston') ||
//                           target.name.includes('observer') ||
//                           target.name.includes('chest') ||
//                           target.name.includes('furnace') ||
//                           target.name.includes('gate');
//
//     if (isDirectional) {
//         const wanted = target.props.facing || 'north';
//         const yawMap = {
//             north: 0,
//             south: Math.PI,
//             west:  Math.PI / 2,
//             east:  -Math.PI / 2
//         };
//         const yaw = yawMap[wanted];
//
//         if (target.props.half === 'top') delta.y = 0.9;
//         else if (target.props.half === 'bottom') delta.y = 0.1;
//
//         await this.bot.look(yaw, 0, true);
//         await new Promise(r => setTimeout(r, 50));
//
//         const originalLookAt = this.bot.lookAt;
//         this.bot.lookAt = () => Promise.resolve();
//
//         try {
//             await this.bot.placeBlock(ref.block, ref.face, delta);
//         } catch (e) {
//             if (!e.message.includes('raycast')) console.log('Place hatası:', e.message);
//         } finally {
//             this.bot.lookAt = originalLookAt;
//         }
//
//         await new Promise(r => setTimeout(r, 250));
//         const newBlock = this.bot.blockAt(target.worldPos);
//         let result = 'NULL';
//         if (newBlock && (newBlock.getProperties || newBlock.properties)) {
//             const props = newBlock.getProperties ? newBlock.getProperties() : newBlock.properties;
//             result = props.facing ? props.facing.toUpperCase() : 'YOK';
//         }
//         if (target.name.includes('stairs')) {
//             const icon = wanted.toUpperCase() === result ? '✅' : '❌';
//             console.log(`\n--- [STAIRS DEBUG] ${icon} ---`);
//             console.log(`🧱 Blok:   ${target.name}`);
//             console.log(`🎯 İstenen: ${wanted.toUpperCase()}`);
//             console.log(`👀 Bot Yaw: ${(yaw * 180 / Math.PI).toFixed(0)}°`);
//             console.log(`📝 SONUÇ:  ${result}`);
//             console.log(`--------------------------\n`);
//         }
//
//         this.lastPlacedPos = target.worldPos.clone();
//         return 'success';
//     }
//
//     await this.bot.lookAt(ref.block.position.offset(0.5, 0.5, 0.5), true);
//     try {
//         await this.bot.placeBlock(ref.block, ref.face, delta);
//     } catch (e) {
//         return 'failed';
//     }
//
//     this.lastPlacedPos = target.worldPos.clone();
//     return 'success';
// }