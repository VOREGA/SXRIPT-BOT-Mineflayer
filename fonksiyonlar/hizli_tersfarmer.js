// --- HIZLANDIRILMIŞ TERS FARMER KODU (fonksiyonlar/farmer.js) ---
// MOD: NO-ANTICHEAT / SPEEDRUN / TERS ÖRGÜ / NO-SELL

const performance = require('perf_hooks').performance;
const vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));




// --- hizli_tersfarmer.js İÇİN startCactusTask ---
async function startCactusTask(totalLayers) {
    // isSelling kontrolünü kaldırdık
    if (this.isBuilding || this.isExcavating || this.cactusState) {
        throw new Error('Bot zaten inşaat veya kazı yapıyor.');
    }
    
    // Malzeme Kontrolü (HIZLI TERSFARMER - YÜKSEK ORANLAR)
    const cactusPerLayer = 24;
    const sandPerLayer = 31;
    const stringPerLayer = 24;
    const scaffoldingPerLayer = 1;

    // --- KAPASİTE HESAPLAYICI ---
    const mainInventorySize = 36; 
    const currentItemsCount = this.bot.inventory.items().length;
    const emptySlots = Math.max(0, mainInventorySize - currentItemsCount);

    if (emptySlots >= 4) {
        let possibleLayers = 0;
        while (true) {
            let nextLayer = possibleLayers + 1;
            
            let cSlots = Math.ceil((nextLayer * cactusPerLayer) / 64);
            let sSlots = Math.ceil((nextLayer * sandPerLayer) / 64);
            let strSlots = Math.ceil((nextLayer * stringPerLayer) / 64);
            let scafSlots = Math.ceil((nextLayer * scaffoldingPerLayer) / 64);

            let totalSlotsNeeded = cSlots + sSlots + strSlots + scafSlots;

            if (totalSlotsNeeded > emptySlots) {
                break; 
            }
            possibleLayers = nextLayer;
        }

        if (possibleLayers > 0) {
            const toStackStr = (count) => {
                const stacks = Math.floor(count / 64);
                const remainder = count % 64;
                if (stacks > 0 && remainder > 0) return `${stacks} Stack + ${remainder}`;
                if (stacks > 0) return `${stacks} Stack`;
                return `${remainder} adet`;
            };

            console.log(`\n[${this.config.username}] [Hesaplayıcı] Envanterinizde ${emptySlots} boş yer var.`);
            console.log(`[${this.config.username}] (Hızlı/Ters) oranlarına göre şu malzemeleri alırsanız:`);
            console.log(`   ● ${toStackStr(possibleLayers * cactusPerLayer)} Kaktüs`);
            console.log(`   ● ${toStackStr(possibleLayers * sandPerLayer)} Kum`);
            console.log(`   ● ${toStackStr(possibleLayers * stringPerLayer)} İp`);
            console.log(`   ● ${toStackStr(possibleLayers * scaffoldingPerLayer)} İskele`);
            console.log(`...MAKSİMUM ${possibleLayers} KATLI kaktüs farmı çıkabilirsiniz.\n`);
        }
    }
    // ---------------------------------------------------

    const totalCactus = totalLayers * cactusPerLayer;
    const totalSand = totalLayers * sandPerLayer;
    const totalString = totalLayers * stringPerLayer;
    const totalScaffolding = totalLayers * scaffoldingPerLayer;

    const inventory = this.bot.inventory.items();
    const cactusCount = inventory.filter(item => item.name === 'cactus').reduce((total, item) => total + item.count, 0);
    const sandCount = inventory.filter(item => item.name === 'sand').reduce((total, item) => total + item.count, 0);
    const stringCount = inventory.filter(item => item.name === 'string').reduce((total, item) => total + item.count, 0);
    const scaffoldingCount = inventory.filter(item => item.name === 'scaffolding').reduce((total, item) => total + item.count, 0);

    if (cactusCount < totalCactus || sandCount < totalSand || stringCount < totalString || scaffoldingCount < totalScaffolding) {
        const errorMessage = `Eksik Malzeme! Envanter: C:${cactusCount}/${totalCactus} S:${sandCount}/${totalSand} Str:${stringCount}/${totalString} Scaf:${scaffoldingCount}/${totalScaffolding}`;
        console.log(`[${this.config.username}] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    console.log(`[${this.config.username}] [HIZLI MOD] Kaktüs görevi başlatılıyor...`);
    this.deleteState(); 
    this.isExcavating = false;  
    this.excavationState = null;
    
    const buildOrigin = this.bot.entity.position.floored();
    this.cactusState = {
        task: 'cactus',
        subType: 'ipli', // Dosyanızda 'ipli' kalmış, uyumluluk için değiştirmedim.
        totalLayers: totalLayers,
        currentLayer: 0,
        currentStepIndex: 0,
        shuffledTaskQueue: null,
        buildOrigin: { x: buildOrigin.x, y: buildOrigin.y, z: buildOrigin.z } 
    };
    
    this.isBuilding = true;
    this.saveState(); 
    
    try {
        await cactus.call(this, this.cactusState);
        console.log(`[${this.config.username}] HIZLI TERS Kaktüs inşası tamamlandı! (${totalLayers} kat)`);
        this.deleteState(); 
    } catch (error) {
        if (error.message.includes('Görev durduruldu') || error.message.includes('Deneme 1 (Resetleme) Tamamlandı.')) {
            console.log(`[${this.config.username}] Görev durduruldu:`, error.message);
        } else {
            console.error(`[${this.config.username}] Kritik Hata: ${error.message}`);
            this.bot.quit('Kaktus gorevi hatayla durdu.');
        }
    } finally {
        this.isBuilding = false;
        console.log(`[${this.config.username}] Görev sonlandı.`);
    }
}





// --- ANA KAKTÜS DÖNGÜSÜ ---
async function cactus(state) {
    // TERS MANTIK ADIMLARI (Input dosyasındaki sıra korundu)
    const layerSteps = [
        // --- 2. Kat (Bot Y=0'da başlar) ---
        { name: 'koykum',      func: koykum.bind(this) },
        { name: 'koyip',       func: koyip.bind(this) },
        { name: 'digkum',      func: digkum.bind(this) },
        
        { name: 'kumkatmani1', func: kumkatmani1.bind(this) },
        { name: 'kumkatmani2', func: kumkatmani2.bind(this) },
        
        // --- Yükselme (Kat 1 -> Kat 2) ---
        { name: 'firstblocksand', func: firstblocksand.bind(this) },
        
        // 3. Kaktüsleri koy (Y=1'de)
        { name: 'cackatmani21', func: cackatmani21.bind(this) },
        { name: 'cackatmani2',  func: cackatmani2.bind(this) },
        { name: 'ipkatmani3',   func: ipkatmani3.bind(this) },
        { name: 'cackatmani3',  func: cackatmani3.bind(this) },
        { name: 'ipkatmani4',   func: ipkatmani4.bind(this) },
        
        // --- Yükselme (Kat 2 -> Kat 3) ---
        { name: 'buildUpScaffolding', func: buildUpScaffolding.bind(this) },
        
        // --- 1. Kat (Bot Y=2'de) ---
        { name: 'buildlayer', func: buildlayer.bind(this) },
        { name: 'ipkatmani1', func: ipkatmani1.bind(this) },
        { name: 'cackatmani1', func: cackatmani1.bind(this) },
        { name: 'ipkatmani2', func: ipkatmani2.bind(this) },
        
        // --- Yükselme (Kat 3 -> Kat 4) ---
        { name: 'firstblocksand', func: firstblocksand.bind(this) },
        { name: 'firstblocksand', func: firstblocksand.bind(this) },
    ];

    for (let layer = state.currentLayer; layer < state.totalLayers; layer++) {
        if (!this.isBuilding) throw new Error('Görev durduruldu.');
        
        state.currentLayer = layer;
        await this.saveState();
        
        for (let i = state.currentStepIndex; i < layerSteps.length; i++) {
            if (!this.isBuilding) throw new Error('Görev durduruldu.');
            
            await this.checkAndEat(true); 
            
            const step = layerSteps[i];
            console.log(`[${this.config.username}] >> Kat ${layer + 1} - Adım: ${step.name}`);

            state.currentStepIndex = i;
            state.shuffledTaskQueue = null; 
            await this.saveState();
            
            await step.func(); 
            
            // HIZLANDIRMA: Adım arası bekleme minimum
            await this.randDelay(10, 50);
        }
        
        state.currentStepIndex = 0; 
        await this.saveState();
    }
}

// --- YAPI VE YARDIMCI FONKSİYONLAR ---
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
    }
    return array;
}

async function runShuffledTasks(tasks, taskGroupName) {
    const state = this.cactusState;
    if (!state) throw new Error("cactusState null!");

    if (!state.shuffledTaskQueue || state.shuffledTaskQueue.length === 0) {
        const shuffledTasks = shuffleArray(tasks);
        state.shuffledTaskQueue = shuffledTasks.map(t => t.id);
        await this.saveState();
    }

    while (state.shuffledTaskQueue.length > 0) {
        if (!this.isBuilding) throw new Error('Görev durduruldu.');
        
        const nextTaskId = state.shuffledTaskQueue[0]; 
        const taskToRun = tasks.find(t => t.id === nextTaskId);

        if (!taskToRun) throw new Error(`Görev ID "${nextTaskId}" bulunamadı!`);
        
        await taskToRun.func();
        
        state.shuffledTaskQueue.shift();
        await this.saveState();
        
        // HIZLANDIRMA: Blok arası bekleme yok (Speedrun)
        await this.randDelay(0, 10);
    }

    state.shuffledTaskQueue = null;
    await this.saveState();
}

function getMasterBuildPos() {
    if (!this.cactusState || !this.cactusState.buildOrigin) {
        if (!this.isBuilding || !this.cactusState) {
             return this.bot.entity.position.floored();
        } else {
             throw new Error("getMasterBuildPos: Origin yok!");
        }
    }
    const origin = this.cactusState.buildOrigin;
    const currentY = this.bot.entity.position.floored().y;
    return vec3(origin.x, currentY, origin.z);
}

// --- OPTİMİZE EDİLMİŞ equipAndPlace ---
async function equipAndPlace(itemName, refOffset, placeVec, actionName, targetBlockName = null, forceSneak = false) {
    targetBlockName = targetBlockName || itemName; 
    
    const item = this.bot.inventory.items().find(i => i.name === itemName);
    if (!item) { throw new Error(`[equipAndPlace] ${itemName} yok!`); }
    
    const botPos = getMasterBuildPos.call(this);
    
    let refBlock = null;
    let finalPlaceVec = vec3(placeVec[0], placeVec[1], placeVec[2]);
    
    const initialRefPos = botPos.offset(refOffset[0], refOffset[1], refOffset[2]);
    let initialRefBlock = this.bot.blockAt(initialRefPos);
    const targetPos = initialRefPos.plus(finalPlaceVec);
    
    if (initialRefBlock && initialRefBlock.name !== 'air') {
        refBlock = initialRefBlock;
    } else {
        const neighbors = [
            [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1],
            [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1],
        ];
        for (const [dx, dy, dz] of neighbors) {
            const potentialRefPos = targetPos.offset(dx, dy, dz);
            const potentialRefBlock = this.bot.blockAt(potentialRefPos);
            const isClickableBlock = potentialRefBlock && potentialRefBlock.name !== 'air' && 
                                     !['tripwire', 'string', 'water', 'lava'].includes(potentialRefBlock.name);

            if (isClickableBlock) {
                 refBlock = potentialRefBlock;
                 finalPlaceVec = targetPos.minus(refBlock.position);
                 break;
            }
        }
        if (!refBlock) throw new Error(`Ref blok yok.`);
    }
    
    const blockAtTarget = this.bot.blockAt(targetPos);
    if (blockAtTarget && blockAtTarget.name === targetBlockName) return;

    try {
        // HIZLANDIRMA: Equip beklemesi yok
        if (this.bot.heldItem?.name !== item.name) await this.bot.equip(item, "hand");
        
        if (forceSneak) this.bot.setControlState('sneak', true);
        
        // HIZLANDIRMA: Bekleme yok
        await this.bot.placeBlock(refBlock, finalPlaceVec);
        
        if (forceSneak) this.bot.setControlState('sneak', false);
        
        // HIZLANDIRMA: Hızlı doğrulama
        let verificationTries = 0;
        const maxTries = 5; 
        const checkInterval = 50; 

        while (verificationTries < maxTries) {
            const currentBlock = this.bot.blockAt(targetPos);
            if (currentBlock && currentBlock.name === targetBlockName) return; 
            verificationTries++;
            await sleep(checkInterval);
        }
        // Hata fırlatmıyoruz, paket gittiyse devam.
        throw new Error(`Blok koyulamadı: ${targetBlockName}`);

    } catch (err) {
        this.bot.setControlState('sneak', false);
        throw err; 
    }
}

// --- OPTİMİZE EDİLMİŞ KAZMA ---
async function digWithShovelAndRetry(targetPos, actionName) {
    const MAX_DIG_RETRIES = 20; 
    const airTypes = ['air', 'cave_air', 'void_air'];
    
    for (let attempt = 0; attempt < MAX_DIG_RETRIES; attempt++) {
        const block = this.bot.blockAt(targetPos);
        if (block && airTypes.includes(block.name)) return;
        if (!block) { await sleep(200); continue; }

        try {
            await this.bot.tool.equipForBlock(block, {});
            
            // HIZLANDIRMA: Kafa çevirme bekleme yok
            this.bot.lookAt(block.position.offset(0.5, 0.5, 0.5), true).catch(()=>{}); 
            
            // HIZLANDIRMA: Animasyon yok, direkt kaz
            await this.bot.dig(block); 
            await sleep(50); 
            
            const currentBlock = this.bot.blockAt(targetPos);
            if (currentBlock && airTypes.includes(currentBlock.name)) return;
            
        } catch (err) {
            console.error(`[DEBUG] Kazma hatası:`, err.message);
        }
        await sleep(100); 
    }
    throw new Error(`${actionName} başarısız oldu`);
}

// --- OPTİMİZE EDİLMİŞ ZIPLAMA ---
async function jumpAndPlace(itemName, actionName) {
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
        if (!item) throw new Error(`Envanterde ${itemName} bulunamadı!`);
        if (this.bot.heldItem?.name !== itemName) await this.bot.equip(item, "hand");
        
        const botPos = this.bot.entity.position.floored();
        const referenceBlock = this.bot.blockAt(botPos.offset(0, -1, 0)); 
        if (!referenceBlock) throw new Error("Alt blok yok.");
        
        const targetPos = referenceBlock.position.plus(vec3(0, 1, 0));
        const lookPos = targetPos.offset(0.5, 0.5, 0.5); 
        this.bot.lookAt(lookPos, true).catch(()=>{});
        
        const jumpY = Math.floor(this.bot.entity.position.y) + 1.0;

        await new Promise((resolve, reject) => {
            let tryCount = 0;
            const MAX_PLACE_TRIES = 10; 
            
            moveListener = async () => { 
                if (!this.bot || !this.bot.entity) return; 
                if (this.bot.entity.position.y > jumpY) {
                    try {
                        await this.bot.placeBlock(referenceBlock, vec3(0, 1, 0));
                        resolve(); 
                    } catch (err) {
                        tryCount++;
                        if (tryCount > MAX_PLACE_TRIES) reject(new Error(`Zıplama başarısız.`));
                    }
                }
            };
            timeoutHandle = setTimeout(() => { reject(new Error(`Zıplama timeout.`)); }, 2000);
            this.bot.setControlState('jump', true);
            this.bot.on('move', moveListener);
        });
        cleanup();
    } catch (error) {
        cleanup();
        throw error;
    }
}

// --- GÖREV FONKSİYONLARI ---
async function buildUp() { await jumpAndPlace.call(this, 'dirt', 'buildUp'); }
async function firstblocksand() { await jumpAndPlace.call(this, 'sand', 'firstblocksand'); }

async function buildlayer() {
    const sandTasks = [
        { id: 'Sand 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 0], [0, 1, 0], "Sand 1"), "Sand 1") },
        { id: 'Sand 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 2], [0, 1, 0], "Sand 2"), "Sand 2") },
        { id: 'Sand 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, 2], [0, 1, 0], "Sand 3"), "Sand 3") },
        { id: 'Sand 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 2], [0, 1, 0], "Sand 4"), "Sand 4") },
        { id: 'Sand 5', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 0], [0, 1, 0], "Sand 5"), "Sand 5") },
        { id: 'Sand 6', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -2], [0, 1, 0], "Sand 6"), "Sand 6") },
        { id: 'Sand 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, -2], [0, 1, 0], "Sand 7"), "Sand 7") },
        { id: 'Sand 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -2], [0, 1, 0], "Sand 8"), "Sand 8") },
        { id: 'Sand 9', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, -1], [0, 1, 0], "Sand 9"), "Sand 9") },
        { id: 'Sand 10', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, -1], [0, 1, 0], "Sand 10"), "Sand 10") },
        { id: 'Sand 11', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 1], [0, 1, 0], "Sand 11"), "Sand 11") },
        { id: 'Sand 12', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 1], [0, 1, 0], "Sand 12"), "Sand 12") }
    ];
    await runShuffledTasks.call(this, sandTasks, 'buildlayer (Sand)');
    
    const cactusTasks = [
        { id: 'Kaktüs 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, 0, 0], [0, 1, 0], "Kaktüs 1"), "Kaktüs 1") },
        { id: 'Kaktüs 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, 0, 2], [0, 1, 0], "Kaktüs 2"), "Kaktüs 2") },
        { id: 'Kaktüs 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, 0, 2], [0, 1, 0], "Kaktüs 3"), "Kaktüs 3") },
        { id: 'Kaktüs 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, 0, 2], [0, 1, 0], "Kaktüs 4"), "Kaktüs 4") },
        { id: 'Kaktüs 5', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, 0, 0], [0, 1, 0], "Kaktüs 5"), "Kaktüs 5") },
        { id: 'Kaktüs 6', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, 0, -2], [0, 1, 0], "Kaktüs 6"), "Kaktüs 6") },
        { id: 'Kaktüs 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, 0, -2], [0, 1, 0], "Kaktüs 7"), "Kaktüs 7") },
        { id: 'Kaktüs 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, 0, -2], [0, 1, 0], "Kaktüs 8"), "Kaktüs 8") }
    ];
    await runShuffledTasks.call(this, cactusTasks, 'buildlayer (Cactus)');
}

async function ipkatmani1() {
    const ipTasks = [
        { id: 'İp 1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, 2], [-1, 0, 0], "İp 1a", 'tripwire', true), "İp 1a") },
        { id: 'İp 1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, 2], [1, 0, 0], "İp 1b", 'tripwire', true), "İp 1b") },
        { id: 'İp 2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, -2], [-1, 0, 0], "İp 2a", 'tripwire', true), "İp 2a") },
        { id: 'İp 2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, -2], [1, 0, 0], "İp 2b", 'tripwire', true), "İp 2b") },
        { id: 'İp 3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 1, 0], [0, 0, -1], "İp 3a", 'tripwire', true), "İp 3a") },
        { id: 'İp 3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 1, 0], [0, 0, 1], "İp 3b", 'tripwire', true), "İp 3b") },
        { id: 'İp 4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 1, 0], [0, 0, -1], "İp 4a", 'tripwire', true), "İp 4a") },
        { id: 'İp 4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 1, 0], [0, 0, 1], "İp 4b", 'tripwire', true), "İp 4b") }
    ];
    await runShuffledTasks.call(this, ipTasks, 'ipkatmani1');
}

async function cackatmani1() {
    const CacTasks = [
        { id: 'Cactus 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, 0, -1], [0, 1, 0], "cac 1"), "cac 1") },
        { id: 'Cactus 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, 0, -1], [0, 1, 0], "cac 2"), "cac 2") },
        { id: 'Cactus 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, 0, 1], [0, 1, 0], "cac 3"), "cac 3") },
        { id: 'Cactus 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, 0, 1], [0, 1, 0], "cac 4"), "cac 4") }
    ];
    await runShuffledTasks.call(this, CacTasks, 'cackatmani1');
}

async function ipkatmani2() {
    const ip2Tasks = [
        { id: 'İp 1 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, 1], [-1, 0, 0], "İp 1", 'tripwire', true), "İp 1") },
        { id: 'İp 2 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, 1], [0, 0, -1], "İp 2", 'tripwire', true), "İp 2") },
        { id: 'İp 3 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, -1], [-1, 0, 0], "İp 3", 'tripwire', true), "İp 3") },
        { id: 'İp 4 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, 1, 1], [0, 0, -1], "İp 4", 'tripwire', true), "İp 4") }
    ];
    await runShuffledTasks.call(this, ip2Tasks, 'ipkatmani2');
}

async function kumkatmani1() {
    const sandTasks = [
        { id: 'Kum 1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 2], [0, 1, 0], "Kum 1a"), "Kum 1a") },
        { id: 'Kum 1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 2], [0, 1, 0], "Kum 1b"), "Kum 1b") },
        { id: 'Kum 2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, -2], [0, 1, 0], "Kum 2a"), "Kum 2a") },
        { id: 'Kum 2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, -2], [0, 1, 0], "Kum 2b"), "Kum 2b") },
        { id: 'Kum 3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -1], [0, 1, 0], "Kum 3a"), "Kum 3a") },
        { id: 'Kum 3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 1], [0, 1, 0], "Kum 3b"), "Kum 3b") },
        { id: 'Kum 4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -1], [0, 1, 0], "Kum 4a"), "Kum 4a") },
        { id: 'Kum 4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 1], [0, 1, 0], "Kum 4b"), "Kum 4b") }
    ];
    await runShuffledTasks.call(this, sandTasks, 'kumkatmani1');
}

async function kumkatmani2() {
    const sandTasks = [
        { id: 'Kum 2-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, 1], [0, 1, 0], "Kum 2-1"), "Kum 2-1") },
        { id: 'Kum 2-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 0], [0, 1, 0], "Kum 2-2"), "Kum 2-2") },
        { id: 'Kum 2-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, -1], [0, 1, 0], "Kum 2-3"), "Kum 2-3") },
        { id: 'Kum 2-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 0], [0, 1, 0], "Kum 2-4"), "Kum 2-4") }
    ];
    await runShuffledTasks.call(this, sandTasks, 'kumkatmani2');
}

async function cackatmani21() {
    const cactusTasks = [
        { id: 'Kaktüs 2-1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, -1, 1], [0, 1, 0], "Kaktüs 2-1a", null, true), "Kaktüs 2-1a") },
        { id: 'Kaktüs 2-2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, -1, 1], [0, 1, 0], "Kaktüs 2-2b", null, true), "Kaktüs 2-2b") },
        { id: 'Kaktüs 2-3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, -1, -1], [0, 1, 0], "Kaktüs 2-3b", null, true), "Kaktüs 2-3b") },
        { id: 'Kaktüs 2-4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, -1, -1], [0, 1, 0], "Kaktüs 2-4a", null, true), "Kaktüs 2-4a") }
    ];
    await runShuffledTasks.call(this, cactusTasks, 'cackatmani21');
}

async function cackatmani2() {
    const cactusTasks = [
        { id: 'Kaktüs 2-1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, 2], [0, 1, 0], "Kaktüs 2-1b", null, true), "Kaktüs 2-1b") },
        { id: 'Kaktüs 2-2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, 2], [0, 1, 0], "Kaktüs 2-2a", null, true), "Kaktüs 2-2a") },
        { id: 'Kaktüs 2-3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, -2], [0, 1, 0], "Kaktüs 2-3a", null, true), "Kaktüs 2-3a") },
        { id: 'Kaktüs 2-4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, -2], [0, 1, 0], "Kaktüs 2-4b", null, true), "Kaktüs 2-4b") }
    ];
    await runShuffledTasks.call(this, cactusTasks, 'cackatmani2');
}

async function cackatmani3() {
    const cactusTasks = [
        { id: 'Kaktüs 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, 0], [0, 1, 0], "Kaktüs 3-1", null, true), "Kaktüs 3-1") },
        { id: 'Kaktüs 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, -1, 1], [0, 1, 0], "Kaktüs 3-2", null, true), "Kaktüs 3-2") },
        { id: 'Kaktüs 3-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, 0], [0, 1, 0], "Kaktüs 3-3", null, true), "Kaktüs 3-3") },
        { id: 'Kaktüs 3-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, -1, -1], [0, 1, 0], "Kaktüs 3-4", null, true), "Kaktüs 3-4") }
    ];
    await runShuffledTasks.call(this, cactusTasks, 'cackatmani3');
}

async function buildUpScaffolding() { 
    await jumpAndPlace.call(this, 'scaffolding', 'buildUpScaffolding'); 
}

async function koykum() {
    const KoyTasks = [
        { id: 'Kum 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -2], [0, 1, 0], "Kum 3-1", 'sand', true), "Kum 3-1") },
        { id: 'Kum 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -2], [0, 1, 0], "Kum 3-2", 'sand', true), "Kum 3-2") },
        { id: 'Kum 3-5', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 2], [0, 1, 0], "Kum 3-5", 'sand', true), "Kum 3-5") },
        { id: 'Kum 3-7', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 2], [0, 1, 0], "Kum 3-7", 'sand', true), "Kum 3-7") }
    ];
    await runShuffledTasks.call(this, KoyTasks, 'koykum');
}

async function koyip() {
    const koyip = [
        { id: 'İp 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 0, -2], [0, 1, 0], "İp 3-1", 'tripwire', true), "İp 3-1") },
        { id: 'İp 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 0, -2], [0, 1, 0], "İp 3-2", 'tripwire', true), "İp 3-2") },
        { id: 'İp 3-5', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 0, 2], [0, 1, 0], "İp 3-5", 'tripwire', true), "İp 3-5") },
        { id: 'İp 3-7', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 0, 2], [0, 1, 0], "İp 3-7", 'tripwire', true), "İp 3-7") }
    ];
    await runShuffledTasks.call(this, koyip, 'koyip');
}

async function digkum() {
    console.log(`[${this.config.username}] [digkum] HIZLI kazma işlemi başlıyor...`);
    this.bot.setControlState('sneak', true); 
    try {
        const botPos = this.bot.entity.position.floored();
        const pos1 = botPos.offset(-2, 0, -2);
        const pos2 = botPos.offset(2, 0, -2);
        const pos3 = botPos.offset(2, 0, 2);
        const pos4 = botPos.offset(-2, 0, 2);

        const tasks = [
            { id: 'kum dig 3-1', func: () => digWithShovelAndRetry.call(this, pos1, 'digkum 3-1') },
            { id: 'kum dig 3-2', func: () => digWithShovelAndRetry.call(this, pos2, 'digkum 3-2') },
            { id: 'kum dig 3-5', func: () => digWithShovelAndRetry.call(this, pos3, 'digkum 3-5') },
            { id: 'kum dig 3-7', func: () => digWithShovelAndRetry.call(this, pos4, 'digkum 3-7') }
        ];

        await runShuffledTasks.call(this, tasks, 'digkum');
    } catch (error) {
        throw error;
    } finally {
        this.bot.setControlState('sneak', false); 
    }
}

async function ipkatmani3() {
    const ipTasks = [
        { id: 'İp 3-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, -1, -2], [0, 1, 0], "İp 3-3", 'tripwire', true), "İp 3-3") }, 
        { id: 'İp 3-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, -1, 0], [0, 1, 0], "İp 3-4", 'tripwire', true), "İp 3-4") },
        { id: 'İp 3-6', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, -1, 2], [0, 1, 0], "İp 3-6", 'tripwire', true), "İp 3-6") }, 
        { id: 'İp 3-8', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, -1, 0], [0, 1, 0], "İp 3-8", 'tripwire', true), "İp 3-8") } 
    ];
    await runShuffledTasks.call(this, ipTasks, 'ipkatmani3');
}

async function ipkatmani4() {
    const ipTasks = [
        { id: 'İp 4-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, -1, 1], [0, 1, 0], "İp 4-1", 'tripwire', true), "İp 4-1") },
        { id: 'İp 4-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, -1, -1], [0, 1, 0], "İp 4-2", 'tripwire', true), "İp 4-2") }, 
        { id: 'İp 4-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, -1, 1], [0, 1, 0], "İp 4-3", 'tripwire', true), "İp 4-3") },
        { id: 'İp 4-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, -1, -1], [0, 1, 0], "İp 4-4", 'tripwire', true), "İp 4-4") }
    ];
    await runShuffledTasks.call(this, ipTasks, 'ipkatmani4');
}

async function placeLastCactus() {
    try {
        const currentBotPos = this.bot.entity.position.floored();
        const centerPos = vec3(this.cactusState.buildOrigin.x, currentBotPos.y, this.cactusState.buildOrigin.z);
        const digPos1 = centerPos.offset(0, -2, 0); 
        const digPos2 = centerPos.offset(0, -3, 0); 
        const placeRefOffset = [0, -4, 0]; 
        
        if (!this.cactusState.jumpPositions || this.cactusState.jumpPositions.length < 4) throw new Error("JumpPositions yok!");
        
        const savedJumpPositions = this.cactusState.jumpPositions.map(p => vec3(p.x, p.y, p.z));
        const randomSideBlock = savedJumpPositions[Math.floor(Math.random() * savedJumpPositions.length)];
        const targetWalkPos = vec3(randomSideBlock.x, currentBotPos.y, randomSideBlock.z);
        
        await this.bot.pathfinder.goto(new GoalNear(targetWalkPos.x, targetWalkPos.y, targetWalkPos.z, 1.0)); 
        this.bot.setControlState('sneak', true); 
        await sleep(50); 

        try {
            await digWithShovelAndRetry.call(this, digPos1, "LastDig1"); 
            await digWithShovelAndRetry.call(this, digPos2, "LastDig2");
        } finally {
            this.bot.setControlState('sneak', false); 
        }
        
        const centerWalkPos = vec3(this.cactusState.buildOrigin.x, currentBotPos.y, this.cactusState.buildOrigin.z);
        await this.bot.pathfinder.goto(new GoalNear(centerWalkPos.x, centerWalkPos.y, centerWalkPos.z, 1.0)); 
        
        await this.retryAction(() => equipAndPlace.call(
            this, 'cactus', placeRefOffset, [0, 1, 0], "LastCactus", null, true
        ), "LastCactus");
    } catch (error) { 
        this.bot.setControlState('sneak', false);
        throw error; 
    }
}

function checkDistanceAndRestartCactus(currentState) {
    if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
    if (!this.bot || !this.bot.entity) {
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartCactus.call(this, currentState), 5000);
        return;
    }
    if (this.isBuilding || !this.cactusState) return;

    const targetPos = vec3(currentState.buildOrigin.x, currentState.buildOrigin.y, currentState.buildOrigin.z);
    const distance = this.bot.entity.position.distanceTo(targetPos);

    if (distance > 100) {
        console.log(`[${this.config.username}] Uzakta, bekleniyor...`);
        this.bot.pathfinder.stop(); 
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartCactus.call(this, currentState), 10000);
    } else {
        console.log(`[${this.config.username}] Devam ediliyor...`);
        this.isBuilding = true;
        (async () => {
             try {
                await cactus.call(this, currentState);
                console.log(`[${this.config.username}] Görev tamamlandı!`);
                this.deleteState(); 
            } catch (error) {
                console.error(`[${this.config.username}] Hata: ${error.message}`);
                this.bot.quit('Restarting...');
            } finally {
                this.isBuilding = false;
            }
        })();
    }
}

async function logPlaceCoords(itemName, referenceOffset, faceVector, actionName) {
    // Debug
}

module.exports = {
    startCactusTask,
    checkDistanceAndRestartCactus,
    logPlaceCoords
};