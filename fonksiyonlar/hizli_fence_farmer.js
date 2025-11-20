// --- HIZLANDIRILMIŞ FENCE FARMER KODU (fonksiyonlar/farmer.js) ---
// MOD: NO-ANTICHEAT / SPEEDRUN / FENCE / NO-SELL

const performance = require('perf_hooks').performance;
const vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));





// --- hizli_fence_farmer.js İÇİN startCactusTask ---
async function startCactusTask(totalLayers) {
    // isSelling kontrolünü kaldırdık
    if (this.isBuilding || this.isExcavating || this.cactusState) {
        throw new Error('Bot zaten inşaat yapıyor.');
    }
    
    // Malzeme Kontrolü (HIZLI FENCE MODU)
    const cactusPerLayer = 9;
    const dirtPerLayer = 19;
    const sandPerLayer = 9;
    const fencePerLayer = 6;

    // --- KAPASİTE HESAPLAYICI ---
    const mainInventorySize = 36; 
    const currentItemsCount = this.bot.inventory.items().length;
    const emptySlots = Math.max(0, mainInventorySize - currentItemsCount);

    if (emptySlots >= 4) {
        let possibleLayers = 0;
        while (true) {
            let nextLayer = possibleLayers + 1;
            
            let cSlots = Math.ceil((nextLayer * cactusPerLayer) / 64);
            let dSlots = Math.ceil((nextLayer * dirtPerLayer) / 64);
            let sSlots = Math.ceil((nextLayer * sandPerLayer) / 64);
            let fSlots = Math.ceil((nextLayer * fencePerLayer) / 64);

            let totalSlotsNeeded = cSlots + dSlots + sSlots + fSlots;

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
            console.log(`[${this.config.username}] (Hızlı/Fence) oranlarına göre şu malzemeleri alırsanız:`);
            console.log(`   ● ${toStackStr(possibleLayers * cactusPerLayer)} Kaktüs`);
            console.log(`   ● ${toStackStr(possibleLayers * dirtPerLayer)} Toprak (Dirt)`);
            console.log(`   ● ${toStackStr(possibleLayers * sandPerLayer)} Kum`);
            console.log(`   ● ${toStackStr(possibleLayers * fencePerLayer)} Demir Parmaklık (Iron Bars)`);
            console.log(`...MAKSİMUM ${possibleLayers} KATLI kaktüs farmı çıkabilirsiniz.\n`);
        }
    }
    // ---------------------------------------------------
    
    const totalCactus = totalLayers * cactusPerLayer;
    const totalDirt = totalLayers * dirtPerLayer;
    const totalSand = totalLayers * sandPerLayer;
    const totalFence = totalLayers * fencePerLayer;
    
    const inventory = this.bot.inventory.items();
    const cactusCount = inventory.filter(item => item.name === 'cactus').reduce((total, item) => total + item.count, 0);
    const dirtCount = inventory.filter(item => item.name === 'dirt').reduce((total, item) => total + item.count, 0);
    const sandCount = inventory.filter(item => item.name === 'sand').reduce((total, item) => total + item.count, 0);
    const fenceCount = inventory.filter(item => item.name === 'iron_bars').reduce((total, item) => total + item.count, 0);

    if (cactusCount < totalCactus || dirtCount < totalDirt || sandCount < totalSand || fenceCount < totalFence) {
        const errorMessage = `Eksik Malzeme! S:${sandCount}/${totalSand} C:${cactusCount}/${totalCactus} D:${dirtCount}/${totalDirt} F:${fenceCount}/${totalFence}`;
        console.log(`[${this.config.username}] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    console.log(`[${this.config.username}] [HIZLI FENCE MOD] Kaktüs görevi başlıyor...`);
    this.deleteState(); 
    this.isExcavating = false;  
    this.excavationState = null;
    
    const buildOrigin = this.bot.entity.position.floored();
    this.cactusState = {
        task: 'cactus',
        subType: 'fence',
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
        console.log(`[${this.config.username}] HIZLI FENCE Kaktüs kulesi tamamlandı! (${totalLayers} kat)`);
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
    const layerSteps = [
        { name: 'buildlayer',      func: buildlayer.bind(this) },
        { name: 'firstblocksand',  func: firstblocksand.bind(this) },
        { name: 'buildUp_1',       func: buildUp.bind(this) },
        { name: 'buildFenceDirt',  func: buildFenceDirt.bind(this) }, 
        { name: 'buildUp_2',       func: buildUp.bind(this) },
        { name: 'placeDirtLayer',  func: placeDirtLayer.bind(this) },
        { name: 'buildUp_3',       func: buildUp.bind(this) },
        { name: 'digLayer',        func: digLayer.bind(this) }, 
        { name: 'placeLastCactus', func: placeLastCactus.bind(this) } 
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
    const refBlockPos = botPos.offset(refOffset[0], refOffset[1], refOffset[2]); 
    const refBlock = this.bot.blockAt(refBlockPos);
    if (!refBlock) { throw new Error(`Ref blok yok.`); }
    
    const targetPos = refBlock.position.plus(vec3(placeVec[0], placeVec[1], placeVec[2]));
    const blockAtTarget = this.bot.blockAt(targetPos);
    if (blockAtTarget && blockAtTarget.name === targetBlockName) return;

    try {
        // HIZLANDIRMA: Equip beklemesi yok
        if (this.bot.heldItem?.name !== item.name) await this.bot.equip(item, "hand");
        
        if (forceSneak) this.bot.setControlState('sneak', true);
        
        // HIZLANDIRMA: Bekleme yok, direkt koy
        await this.bot.placeBlock(refBlock, vec3(placeVec[0], placeVec[1], placeVec[2]));
        
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
        // Hata fırlatmıyoruz
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

async function digLayer() {
    this.bot.setControlState('sneak', true);
    try {
        const botPos = this.bot.entity.position.floored();
        const pos1 = botPos.offset(2, -2, 0);
        const pos2 = botPos.offset(2, -2, 2);
        const pos3 = botPos.offset(0, -2, 2);
        const pos4 = botPos.offset(-2, -2, 2);
        const pos5 = botPos.offset(-2, -2, 0);
        const pos6 = botPos.offset(-2, -2, -2);
        const pos7 = botPos.offset(0, -2, -2);
        const pos8 = botPos.offset(2, -2, -2);

        const tasks = [
            { id: 'dig 1', func: () => digWithShovelAndRetry.call(this, pos1, 'digLayer 1') },
            { id: 'dig 2', func: () => digWithShovelAndRetry.call(this, pos2, 'digLayer 2') },
            { id: 'dig 3', func: () => digWithShovelAndRetry.call(this, pos3, 'digLayer 3') },
            { id: 'dig 4', func: () => digWithShovelAndRetry.call(this, pos4, 'digLayer 4') },
            { id: 'dig 5', func: () => digWithShovelAndRetry.call(this, pos5, 'digLayer 5') },
            { id: 'dig 6', func: () => digWithShovelAndRetry.call(this, pos6, 'digLayer 6') },
            { id: 'dig 7', func: () => digWithShovelAndRetry.call(this, pos7, 'digLayer 7') },
            { id: 'dig 8', func: () => digWithShovelAndRetry.call(this, pos8, 'digLayer 8') }
        ];
        await runShuffledTasks.call(this, tasks, 'digLayer');
    } finally {
        this.bot.setControlState('sneak', false);
    }
}

async function buildlayer() {
    const sandTasks = [
        { id: 'Sand 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 0], [0, 1, 0], "Sand 1"), "Sand 1") },
        { id: 'Sand 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 2], [0, 1, 0], "Sand 2"), "Sand 2") },
        { id: 'Sand 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, 2], [0, 1, 0], "Sand 3"), "Sand 3") },
        { id: 'Sand 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 2], [0, 1, 0], "Sand 4"), "Sand 4") },
        { id: 'Sand 5', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 0], [0, 1, 0], "Sand 5"), "Sand 5") },
        { id: 'Sand 6', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -2], [0, 1, 0], "Sand 6"), "Sand 6") },
        { id: 'Sand 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, -2], [0, 1, 0], "Sand 7"), "Sand 7") },
        { id: 'Sand 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -2], [0, 1, 0], "Sand 8"), "Sand 8") }
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

async function buildFenceDirt() {
    const tasks = [
        // HIZLANDIRMA: Ara beklemeler silindi (async zinciri devam eder)
        { id: 'Çit 1', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [2, -1, 2], [0, 1, 0], "Dirt 1 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [2, 0, 2], [0, 0, -1], "Çit 1"); }, "Çit 1") },
        { id: 'Çit 2', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [0, -1, 2], [0, 1, 0], "Dirt 2 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [0, 0, 2], [0, 0, -1], "Çit 2"); }, "Çit 2") },
        { id: 'Çit 3', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [-2, -1, 2], [0, 1, 0], "Dirt 3 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [-2, 0, 2], [0, 0, -1], "Çit 3"); }, "Çit 3") },
        { id: 'Çit 4', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [-2, -1, -2], [0, 1, 0], "Dirt 4 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [-2, 0, -2], [0, 0, 1], "Çit 4"); }, "Çit 4") },
        { id: 'Çit 5', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [0, -1, -2], [0, 1, 0], "Dirt 5 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [0, 0, -2], [0, 0, 1], "Çit 5"); }, "Çit 5") },
        { id: 'Çit 6', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [2, -1, -2], [0, 1, 0], "Dirt 6 (Çitli)"); await equipAndPlace.call(this, 'iron_bars', [2, 0, -2], [0, 0, 1], "Çit 6"); }, "Çit 6") },
        { id: 'Dirt 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [2, -1, 0], [0, 1, 0], "Dirt 7 (Tekli)"), "Dirt 7 (Tekli)") },
        { id: 'Dirt 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [-2, -1, 0], [0, 1, 0], "Dirt 8 (Tekli)"), "Dirt 8 (Tekli)") }
    ];
    await runShuffledTasks.call(this, tasks, 'buildFenceDirt');
}

async function placeDirtLayer() {
    const botPos = getMasterBuildPos.call(this);
    const jumpPositions = [
        botPos.offset(2, 0, 0),
        botPos.offset(0, 0, 2),
        botPos.offset(-2, 0, 0),
        botPos.offset(0, 0, -2)
    ];
    this.cactusState.jumpPositions = jumpPositions.map(p => ({ x: p.x, y: p.y, z: p.z }));
    await this.saveState(); 

    const tasks = [
        { id: 'DirtK 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [2, -1, 0], [0, 1, 0], "Dirt Katmanı 1"), "Dirt Katmanı 1") },
        { id: 'DirtK 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [2, -1, 2], [0, 1, 0], "Dirt Katmanı 2"), "Dirt Katmanı 2") },
        { id: 'DirtK 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [0, -1, 2], [0, 1, 0], "Dirt Katmanı 3"), "Dirt Katmanı 3") },
        { id: 'DirtK 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [-2, -1, 2], [0, 1, 0], "Dirt Katmanı 4"), "Dirt Katmanı 4") },
        { id: 'DirtK 5', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [-2, -1, 0], [0, 1, 0], "Dirt Katmanı 5"), "Dirt Katmanı 5") },
        { id: 'DirtK 6', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [-2, -1, -2], [0, 1, 0], "Dirt Katmanı 6"), "Dirt Katmanı 6") },
        { id: 'DirtK 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [0, -1, -2], [0, 1, 0], "Dirt Katmanı 7"), "Dirt Katmanı 7") },
        { id: 'DirtK 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [2, -1, -2], [0, 1, 0], "Dirt Katmanı 8"), "Dirt Katmanı 8") }
    ];
    await runShuffledTasks.call(this, tasks, 'placeDirtLayer');
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