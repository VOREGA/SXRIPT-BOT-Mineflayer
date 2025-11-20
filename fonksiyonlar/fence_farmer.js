// --- YENİ KOD (fonksiyonlar/farmer.js) ---

// 1. REQUIRE'lar (performance modülü düzeltildi)
const performance = require('perf_hooks').performance;
const vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));







// --- fence_farmer.js İÇİN startCactusTask ---
async function startCactusTask(totalLayers) {
    // 'this' BotInstance'ı referans alır
    if (this.isBuilding || this.isSelling || this.isExcavating || this.cactusState) {
        throw new Error('Bot zaten meşgul (inşaat, satış, kazı veya devam eden kaktüs görevi var).');
    }
    
    // Malzeme Kontrolü (FENCE MODU ORANLARI)
    const cactusPerLayer = 9;
    const dirtPerLayer = 19; // Yükselme ve platform için Dirt kullanılıyor
    const sandPerLayer = 9;
    const fencePerLayer = 6; // Iron Bars

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
            console.log(`[${this.config.username}] (Fence/Çit) oranlarına göre şu malzemeleri alırsanız:`);
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
        const errorMessage = `Gerekli itemler yok. İtemler:
        Sand: ${sandCount}/${totalSand}
        Cactus: ${cactusCount}/${totalCactus}
        Dirt: ${dirtCount}/${totalDirt}
        Fence: ${fenceCount}/${totalFence}`;
        console.log(`[${this.config.username}] ${errorMessage}`);
        throw new Error(errorMessage);
    }

    console.log(`[${this.config.username}] [Cactus] Yeni kaktüs görevi için eski görevler temizleniyor...`);
    this.deleteState(); 
    this.isExcavating = false;  
    this.excavationState = null;
    
    console.log(`[${this.config.username}] Envanterde gerekli olan tüm itemler var. ${totalLayers} katlı kaktüs kulesi dikmeye başlıyorum.`);
    
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
        console.log(`[${this.config.username}] Kaktüs kulesi inşaası tamamlandı! (${totalLayers} kat)`);
        this.deleteState(); 

    } catch (error) {
        if (error.message.includes('Görev durduruldu') || error.message.includes('Deneme 1 (Resetleme) Tamamlandı.')) {
            console.log(`[${this.config.username}] [Cactus] Görev bir hatayla durdu (izin verilen hata/reset):`, error.message);
        } else {
            console.error(`[${this.config.username}] [Cactus] Görev kalıcı bir hatayla durdu: ${error.message}`);
            this.bot.quit('Kaktus gorevi kalici hatayla durdu, yeniden baslatilacak.');
        }
    } finally {
        this.isBuilding = false; 
        console.log(`[${this.config.username}] [Cactus] İnşaat görevi sonlandı (veya duraklatıldı).`);
    }
}







// --- ANA KAKTÜS DÖNGÜSÜ ---
async function cactus(state) {
    // 'this' BotInstance'ı referans alır
    
    const layerSteps = [
        { name: 'buildlayer',      func: buildlayer.bind(this) },
        { name: 'firstblocksand',  func: firstblocksand.bind(this) },
        { name: 'buildUp_1',       func: buildUp.bind(this) },
        { name: 'buildFenceDirt',  func: buildFenceDirt.bind(this) }, //öbüründen silinecek
        { name: 'buildUp_2',       func: buildUp.bind(this) },
        { name: 'placeDirtLayer',  func: placeDirtLayer.bind(this) },//öbüründen silinecek
        { name: 'buildUp_3',       func: buildUp.bind(this) },
        { name: 'digLayer',        func: digLayer.bind(this) }, //öbüründen silinecek
        { name: 'placeLastCactus', func: placeLastCactus.bind(this) } //öbüründen silinecek
    ];

    for (let layer = state.currentLayer; layer < state.totalLayers; layer++) {
        if (!this.isBuilding) throw new Error('Görev durduruldu (yeni kat).');
        
        console.log(`[${this.config.username}] [Cactus] Katman ${layer + 1}/${state.totalLayers} başlıyor...`);
        
        state.currentLayer = layer;
        await this.saveState();
        
        for (let i = state.currentStepIndex; i < layerSteps.length; i++) {
            if (!this.isBuilding) throw new Error('Görev durduruldu (yeni adım).');
            
            await this.checkAndEat(true); // Her adımdan önce yemek ye
            if (!this.isBuilding) throw new Error('Görev durduruldu (yemek).');
            
            const step = layerSteps[i];
            console.log(`[${this.config.username}] [Cactus] Katman ${layer + 1}, Adım ${i + 1}/${layerSteps.length} (${step.name}) başlıyor...`);

            state.currentStepIndex = i;
            state.shuffledTaskQueue = null; 
            await this.saveState();
            
            await step.func(); 
            
            await this.randDelay(1500, 2000);
        }
        
        console.log(`[${this.config.username}] [Cactus] Katman ${layer + 1} tamamlandı.`);
        state.currentStepIndex = 0; // Sonraki katman için adımı sıfırla
        await this.saveState();
    }
}


// --- İNSANLAŞTIRMA VE YAPI ---
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
    // 'this' BotInstance'ı referans alır
    const state = this.cactusState;
    if (!state) throw new Error("runShuffledTasks çağrıldığında cactusState null olamaz!");

    // 1. Adım: Kuyruk boşsa, oluştur ve kaydet
    if (!state.shuffledTaskQueue || state.shuffledTaskQueue.length === 0) {
        console.log(`[${this.config.username}] [Shuffle] '${taskGroupName}' görevi için ${tasks.length} adet hamle karıştırılıyor...`);
        const shuffledTasks = shuffleArray(tasks);
        state.shuffledTaskQueue = shuffledTasks.map(t => t.id); // Sadece ID'leri kaydet
        await this.saveState();
    } else {
        console.log(`[${this.config.username}] [Shuffle] '${taskGroupName}' görevi için ${state.shuffledTaskQueue.length} adet kalan hamleye devam ediliyor...`);
    }

    // 2. Adım: Kaydedilmiş kuyruğu işle
    const totalTasksAtStart = tasks.length;
    let completedTasks = totalTasksAtStart - state.shuffledTaskQueue.length;

    while (state.shuffledTaskQueue.length > 0) {
        if (!this.isBuilding) throw new Error('Görev durduruldu (runShuffledTasks).');
        
        const nextTaskId = state.shuffledTaskQueue[0]; 
        const taskToRun = tasks.find(t => t.id === nextTaskId);

        if (!taskToRun) {
            throw new Error(`[Shuffle] '${taskGroupName}' için kaydedilmiş görev ID'si "${nextTaskId}" bulunamadı!`);
        }
        
        console.log(`[${this.config.username}] [Shuffle] '${taskGroupName}' ${completedTasks + 1}/${totalTasksAtStart} hamlesi yapılıyor: ${nextTaskId}`);
        
        await taskToRun.func(); // Fonksiyonu çalıştır
        
        // Başarılıysa kuyruktan çıkar ve durumu kaydet
        state.shuffledTaskQueue.shift();
        await this.saveState(); // <-- Her alt-adımda kaydet
        
        completedTasks++;
        await this.randDelay(400, 700);
    }

    // 3. Adım: Adım tamamlandı, kuyruğu temizle
    state.shuffledTaskQueue = null;
    await this.saveState();
}

// --- ************************************************* ---
// --- YENİ YARDIMCI FONKSİYON (ANA POZİSYON) ---
// --- ************************************************* ---
function getMasterBuildPos() {
    // 'this' BotInstance'ı referans alır
    if (!this.cactusState || !this.cactusState.buildOrigin) {
        // Bu durum normalde olmamalı, ama jumpAndPlace gibi tekil fonksiyonlar
        // (buildUp) çağrılırsa diye güvenlik önlemi.
        if (!this.isBuilding || !this.cactusState) {
             console.warn(`[${this.config.username}] [getMasterBuildPos] Uyarı: cactusState olmadan çağrıldı. Normal bot pozisyonu kullanılıyor.`);
             return this.bot.entity.position.floored();
        } else {
             // Görev varsa ama origin yoksa bu kritik hatadır.
             throw new Error("getMasterBuildPos: cactusState.buildOrigin bulunamadı!");
        }
    }
    
    // ASIL MANTIK:
    // X ve Z'yi her zaman SABİT orijinden al.
    const origin = this.cactusState.buildOrigin;
    // Y'yi ise botun o anki, buildUp'lar ile ulaştığı YÜKSEKLİĞİNDEN al.
    const currentY = this.bot.entity.position.floored().y;
    
    // Bu, (origin.x, currentY, origin.z) pozisyonunu döndürür.
    // Bot X/Z'de 0.2 blok kaysa bile, hesaplama merkezi (origin.x, origin.z) kalır.
    return vec3(origin.x, currentY, origin.z);
}






// --- ************************************************* ---
// --- GÜNCELLENDİ (forceSneak parametresi eklendi) ---
// --- ************************************************* ---
async function equipAndPlace(itemName, refOffset, placeVec, actionName, targetBlockName = null, forceSneak = false) {
    // 'this' BotInstance'ı referans alır
    targetBlockName = targetBlockName || itemName; 
    const item = this.bot.inventory.items().find(i => i.name === itemName);
    if (!item) { throw new Error(`[equipAndPlace] Envanterde ${itemName} bulunamadı!`); }
    
    const botPos = getMasterBuildPos.call(this);
    const refBlockPos = botPos.offset(refOffset[0], refOffset[1], refOffset[2]); 
    const refBlock = this.bot.blockAt(refBlockPos);
    if (!refBlock) { throw new Error(`[equipAndPlace] ${actionName} için referans blok (${refBlockPos}) bulunamadı!`); }
    
    const targetPos = refBlock.position.plus(vec3(placeVec[0], placeVec[1], placeVec[2]));
    
    console.log(`[${this.config.username}] [Coords] '${actionName}' (Yerleştirme) | Hedef: ${targetPos}`);
    
    const blockAtTarget = this.bot.blockAt(targetPos);
    if (blockAtTarget && blockAtTarget.name === targetBlockName) {
        console.log(`[${this.config.username}] [Skip] ${actionName} bloğu (${targetBlockName}) zaten yerinde.`);
        return;
    }

    try {
        await this.bot.equip(item, "hand");
        await this.randDelay(100, 300); 
        
        // --- DEĞİŞİKLİK: forceSneak kontrolü eklendi ---
        // forceSneak = true ise VEYA rastgele %40 ihtimalle eğil
        const willSneak = forceSneak || Math.random() < 0.4; 
        // --- DEĞİŞİKLİK BİTİŞ ---

        const willBeSlow = Math.random() < 0.15; 
        
        if (willSneak) {
            this.bot.setControlState('sneak', true);
            await this.randDelay(50, 100);
        }
        if (willBeSlow) {
            console.log(`[${this.config.username}] [Humanize] ${actionName} yavaş modda yapılıyor...`);
            await this.randDelay(400, 800);
        }
        
        await this.bot.placeBlock(refBlock, vec3(placeVec[0], placeVec[1], placeVec[2]));
        await this.randDelay(50, 100); 
        
        if (willSneak) {
            this.bot.setControlState('sneak', false);
        }
        
        await this.randDelay(250, 300); 

        // --- DOĞRULAMA DÖNGÜSÜ ---
        let verificationTries = 0;
        const maxTries = 10; 
        const checkInterval = 500; 

        while (verificationTries < maxTries) {
            const currentBlock = this.bot.blockAt(targetPos);
            if (currentBlock && currentBlock.name === targetBlockName) {
                console.log(`[${this.config.username}] [Coords] '${actionName}' (Yerleştirme) | BAŞARILI. Blok '${targetBlockName}' olarak doğrulandı.`);
                return; 
            }
            
            verificationTries++;
            console.warn(`[${this.config.username}] [Coords] '${actionName}' (Doğrulama) | Blok henüz '${targetBlockName}' değil. Deneme ${verificationTries}/${maxTries}...`);
            await this.randDelay(checkInterval, checkInterval + 100);
        }

        throw new Error(`Blok ${maxTries} denemeden sonra yerleştirilemedi (sunucu reddetti?).`);

    } catch (err) {
        console.error(`[${this.config.username}] [equipAndPlace] '${actionName}' sırasında kritik hata: ${err.message}`);
        this.bot.setControlState('sneak', false);
        throw err; 
    }
}









 
/*
 * Bu kodun, this.bot ve this.config'e erişimi olan
 * bir sınıfın (class) içinde olduğunu varsayıyoruz.
 * 'sleep' fonksiyonunun da projenizde tanımlı olması gerekir:
 * const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
 */

/**
 * Belirtilen pozisyodaki bloğu, RASTGELE bir el sallama animasyonuyla (sağ veya sol)
 * ve kırma süresini (ms) manuel hesaplayarak kırmaya çalışır.
 * Maksimum deneme sayısı 50'ye yükseltildi.
 *
 * @param {Vec3} targetPos - Kırılacak bloğun pozisyonu (Vec3).
 * @param {string} actionName - Loglamada görünecek eylem adı (örn: "Kaktüs Tabanı Kazma").
 */
async function digWithShovelAndRetry(targetPos, actionName) {
    console.log(`[DEBUG] ${actionName} başlıyor, pozisyon: ${targetPos}`);
    
    // --- DEĞİŞİKLİK BURADA ---
    const MAX_DIG_RETRIES = 50; // 20'den 50'ye yükseltildi
    // --- DEĞİŞİKLİK SONU ---
    
    const airTypes = ['air', 'cave_air', 'void_air'];
    
    for (let attempt = 0; attempt < MAX_DIG_RETRIES; attempt++) {
        console.log(`[DEBUG] Deneme ${attempt + 1}/${MAX_DIG_RETRIES}`);
        
        const block = this.bot.blockAt(targetPos);
        console.log(`[DEBUG] Blok durumu: ${block ? block.name : 'null'}`);
        
        if (block && airTypes.includes(block.name)) {
            console.log(`[${this.config.username}] [Skip] ${actionName} zaten hava.`);
            return; 
        }
        
        if (!block) {
            console.warn(`[DEBUG] Blok bulunamadı!`);
            await sleep(1000);
            continue;
        }

        let swingInterval = null; 

        try {
            // 1. Alet hazırlama
            console.log(`[DEBUG] Alet hazırlanıyor...`);
            await this.bot.tool.equipForBlock(block, {});
            const heldItem = this.bot.heldItem;
            console.log(`[DEBUG] Kullanılan alet: ${heldItem ? heldItem.name : 'none'}`);
            
            // 2. Bakış
            const lookPos = block.position.offset(0.5, 0.5, 0.5);
            await this.bot.lookAt(lookPos, true);
            
            // Kafa çevirme için bekleme
            console.log(`[DEBUG] Kafa çevrildi, sunucu onayı bekleniyor...`);
            await sleep(150); 
            
            // 3. Kırma süresi
            const totalBreakTime = this.bot.digTime(block, heldItem ? heldItem.type : null);
            console.log(`[DEBUG] Hesaplanan kırma süresi: ${totalBreakTime}ms`);

            // --- DEĞİŞİKLİK BURADA ---
            // Bu deneme için rastgele bir el seç
            const handToSwing = Math.random() < 0.5 ? 'right' : 'left';
            console.log(`[DEBUG] Bu deneme için ${handToSwing} el sallanacak.`);
            // --- DEĞİŞİKLİK SONU ---
            
            // 4. Kırma işlemi
            const randomFace = 2 + Math.floor(Math.random() * 4); 
            
            try {
                console.log(`[DEBUG] Kırma başlatılıyor...`);
                this.bot._client.write('block_dig', { 
                    status: 0, 
                    location: block.position, 
                    face: randomFace 
                });

                // El sallamayı seçilen rastgele elle başlat
                this.bot.swingArm(handToSwing); // İlk sallamayı hemen yap
                swingInterval = setInterval(() => {
                    this.bot.swingArm(handToSwing); // Her 500ms'de bir aynı kolu salla
                }, 500); 

                // Hesaplanan süre kadar bekleme
                await sleep(totalBreakTime > 0 ? totalBreakTime : 1000); 

            } finally {
                if (swingInterval) {
                    clearInterval(swingInterval); 
                    console.log(`[DEBUG] El sallama durduruldu.`);
                }
            }

            console.log(`[DEBUG] Kırma bitiriliyor...`);
            this.bot._client.write('block_dig', { 
                status: 2, 
                location: block.position, 
                face: randomFace 
            });
            
            // Doğrulama
            await sleep(500); 
            const currentBlock = this.bot.blockAt(targetPos);
            console.log(`[DEBUG] Kazma sonrası blok: ${currentBlock ? currentBlock.name : 'null'}`);
            
            if (currentBlock && airTypes.includes(currentBlock.name)) {
                console.log(`[${this.config.username}] [Success] ${actionName} başarılı!`);
                return;
            }
            
        } catch (err) {
            console.error(`[DEBUG] Deneme ${attempt + 1} hatası:`, err);
        }
        
        await sleep(1000); 
    }
    
    throw new Error(`${actionName} ${MAX_DIG_RETRIES} denemeden sonra başarısız oldu`);
}

 






async function jumpAndPlace(itemName, actionName) {
    let moveListener = null;
    let timeoutHandle = null;

    // Tüm dinleyicileri ve kontrolleri güvenle temizler
    const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        
        // *** TypeError ÇÖZÜMÜ BURADA ***
        // 'this.bot' null (atılmış) olsa bile çökmemesi için
        // önce varlığını kontrol et.
        if (this.bot) { 
            this.bot.setControlState('jump', false);
            if (moveListener) {
                this.bot.removeListener('move', moveListener);
            }
        }
    };

    try {
        await this.randDelay(400, 600);
        const item = this.bot.inventory.items().find(i => i.name === itemName);
        if (!item) throw new Error(`Envanterde ${itemName} bulunamadı!`);
        await this.retryAction(() => this.bot.equip(item, "hand"), `${actionName} - ${itemName} Alma`);
        
        const botPos = this.bot.entity.position.floored();
        const referenceBlock = this.bot.blockAt(botPos.offset(0, -1, 0)); 
        if (!referenceBlock) throw new Error("Referans blok bulunamadı (altımız boş?).");
        
        // --- 1. DÜZELTME: "Geçersiz Rotasyonlar" Hatası için ---
        
        // ÖNCE HEDEF POZİSYONU HESAPLA (Bloğu koyacağımız yer)
        const targetPos = referenceBlock.position.plus(vec3(0, 1, 0));
        
        // ŞİMDİ REFERANS BLOK YERİNE, HEDEF BLOĞUN ORTASINA BAK
        // Bu, botun dümdüz aşağı (90 derece) bakmasını engeller ve anti-hile'ye takılmaz.
        const lookPos = targetPos.offset(0.5, 0.5, 0.5); 
        
        console.log(`[${this.config.username}] [Coords] '${actionName}' (Zıpla-Koy) | Bakış ${lookPos}'a çevriliyor...`);
        await this.bot.lookAt(lookPos, true); // O bloğa bak
        await this.randDelay(150, 250); // Sunucunun kafa dönüşünü algılaması için bekle
        // --- 1. DÜZELTME BİTİŞ ---

        console.log(`[${this.config.username}] [Coords] '${actionName}' (Zıpla-Koy) | Hedef: ${targetPos}`);

        const jumpY = Math.floor(this.bot.entity.position.y) + 1.0;

        await new Promise((resolve, reject) => {
            let tryCount = 0;
            const MAX_PLACE_TRIES = 10; 
            
            moveListener = async () => { // 'placeIfHighEnough'
                // Bot atılırsa diye 'move' içini de güvenli hale al
                if (!this.bot || !this.bot.entity) {
                    return; 
                }

                if (this.bot.entity.position.y > jumpY) {
                    try {
                        await this.bot.placeBlock(referenceBlock, vec3(0, 1, 0));
                        resolve(); // Başarılı, promise'i bitir
                    } catch (err) {
                        tryCount++;
                        console.warn(`[${this.config.username}] [${actionName}] Zıplarken koyma denemesi ${tryCount}/${MAX_PLACE_TRIES} başarısız: ${err.message}`);
                        if (tryCount > MAX_PLACE_TRIES) {
                            reject(new Error(`${actionName} ${MAX_PLACE_TRIES} denemeden sonra başarısız oldu.`));
                        }
                    }
                }
            };
            
            timeoutHandle = setTimeout(() => {
                // Bu reject, dışarıdaki catch bloğunu tetikler
                reject(new Error(`${actionName} zaman aşımına uğradı (5s). Bot zıplayamadı.`));
            }, 5000);
            
            this.bot.setControlState('jump', true);
            this.bot.on('move', moveListener);
        });
        
        // Promise başarıyla biterse:
        cleanup(); // Dinleyicileri temizle

    } catch (error) {
        // Promise'de (timeout vb.) veya öncesinde (lookAt vb.) hata olursa:
        console.error(`[${this.config.username}] [${actionName}] Ana işlem hatası:`, error.message);
        cleanup(); // Dinleyicileri temizle (ÇÖKMEYİ ÖNLER)
        throw error; // Hatayı yeniden fırlat ki ana döngü bilsin
    }
}













async function buildUp() { await jumpAndPlace.call(this, 'dirt', 'buildUp'); }
async function firstblocksand() { await jumpAndPlace.call(this, 'sand', 'firstblocksand'); }






async function buildUp() { await jumpAndPlace.call(this, 'dirt', 'buildUp'); }
async function firstblocksand() { await jumpAndPlace.call(this, 'sand', 'firstblocksand'); }




// --- ************************************************* ---
// --- GÜNCELLENDİ (Eğilerek Kazma Eklendi) ---
// --- ************************************************* ---
async function digLayer() {
    console.log(`[${this.config.username}] [digLayer] Eğilerek kazma işlemi başlıyor...`);
    this.bot.setControlState('sneak', true); // <-- EĞİL
    await this.randDelay(100, 200); // Eğilmek için bekle

    try {
        // 🔧 ÖNEMLİ: Artık getMasterBuildPos kullanılmıyor
        // Botun gerçek konumu baz alınacak (buildOrigin değil)
        const botPos = this.bot.entity.position.floored();

        // Aynı pozisyon mantığı devam ediyor ama artık kayma yok
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

        // Görev sırasını rastgeleleştir (runShuffledTasks aynı kalıyor)
        await runShuffledTasks.call(this, tasks, 'digLayer');
        
        console.log(`[${this.config.username}] [digLayer] Eğilerek kazma tamamlandı.`);

    } catch (error) {
        console.error(`[${this.config.username}] Kazma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error; // Hatayı fırlat
    } finally {
        this.bot.setControlState('sneak', false); // <-- AYAĞA KALK (Hata olsa da olmasa da)
        await this.randDelay(100, 200);
    }
}



async function buildlayer() {
    try {
        // Not: Koordinat logları ve doğrulama 'equipAndPlace' fonksiyonu içinde zaten yapılıyor.
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
        
        await this.randDelay(400, 600);
        
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
    } catch (error) { console.error(`[${this.config.username}] Katman oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}

// --- ************************************************* ---
// --- GÜNCELLENDİ (retryAction eklendi) ---
// --- ************************************************* ---
async function buildFenceDirt() {
    try {
        // Not: Koordinat logları ve doğrulama 'equipAndPlace' fonksiyonu içinde zaten yapılıyor.
        const tasks = [
            { id: 'Çit 1', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [2, -1, 2], [0, 1, 0], "Dirt 1 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [2, 0, 2], [0, 0, -1], "Çit 1"); }, "Çit 1") },
            { id: 'Çit 2', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [0, -1, 2], [0, 1, 0], "Dirt 2 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [0, 0, 2], [0, 0, -1], "Çit 2"); }, "Çit 2") },
            { id: 'Çit 3', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [-2, -1, 2], [0, 1, 0], "Dirt 3 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [-2, 0, 2], [0, 0, -1], "Çit 3"); }, "Çit 3") },
            { id: 'Çit 4', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [-2, -1, -2], [0, 1, 0], "Dirt 4 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [-2, 0, -2], [0, 0, 1], "Çit 4"); }, "Çit 4") },
            { id: 'Çit 5', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [0, -1, -2], [0, 1, 0], "Dirt 5 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [0, 0, -2], [0, 0, 1], "Çit 5"); }, "Çit 5") },
            { id: 'Çit 6', func: () => this.retryAction(async () => { await equipAndPlace.call(this, 'dirt', [2, -1, -2], [0, 1, 0], "Dirt 6 (Çitli)"); await this.randDelay(400, 600); await equipAndPlace.call(this, 'iron_bars', [2, 0, -2], [0, 0, 1], "Çit 6"); }, "Çit 6") },
            { id: 'Dirt 7', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [2, -1, 0], [0, 1, 0], "Dirt 7 (Tekli)"), "Dirt 7 (Tekli)") },
            { id: 'Dirt 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'dirt', [-2, -1, 0], [0, 1, 0], "Dirt 8 (Tekli)"), "Dirt 8 (Tekli)") }
        ];
        await runShuffledTasks.call(this, tasks, 'buildFenceDirt');
    } catch (error) { console.error(`[${this.config.username}] Çit inşa etme işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}












//last up start


// --- YENİ KOD (Sadece değişen fonksiyonlar) ---
// Dosyanızdaki mevcut 'placeDirtLayer' ve 'placeLastCactus' fonksiyonlarını
// bu iki fonksiyonla değiştirin.
// Diğer tüm fonksiyonlar (equipAndPlace, digWithShovelAndRetry, vb.) aynı kalmalıdır.

// --- ************************************************* ---
// --- GÜNCELLENDİ (retryAction eklendi VE JUMP POZİSYONLARI KAYDEDİLDİ) ---
// --- ************************************************* ---
async function placeDirtLayer() {
    try {
        // --- YENİ EKLENTİ: Yana zıplama pozisyonlarını kaydet ---
        // placeLastCactus adımında kullanılmak üzere 4 "kenar" bloğun
        // (köşe olmayan) mutlak koordinatlarını state'e kaydet.
        const botPos = getMasterBuildPos.call(this); // (origin.x, currentY, origin.z)
        const jumpPositions = [
            botPos.offset(2, 0, 0),  // DirtK 1'in hedefi
            botPos.offset(0, 0, 2),  // DirtK 3'ün hedefi
            botPos.offset(-2, 0, 0), // DirtK 5'in hedefi
            botPos.offset(0, 0, -2)  // DirtK 7'nin hedefi
        ];
        
        // State'e kaydederken vec3'ü düz objeye çevir (JSON uyumlu)
        this.cactusState.jumpPositions = jumpPositions.map(p => ({ x: p.x, y: p.y, z: p.z }));
        await this.saveState(); // jumpPositions'ı kaydet
        console.log(`[${this.config.username}] [placeDirtLayer] 4 adet jump pozisyonu state'e kaydedildi (Örn: ${JSON.stringify(this.cactusState.jumpPositions[0])})`);
        // --- YENİ EKLENTİ BİTİŞ ---

        // Not: Koordinat logları ve doğrulama 'equipAndPlace' fonksiyonu içinde zaten yapılıyor.
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
    } catch (error) { console.error(`[${this.config.username}] Dirt katmanı yerleştirme işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}





// --- ************************************************* ---
// --- GÜNCELLENDİ (YANA YÜRÜME, EĞİLEREK KAZMA, GOTO TOLERANSI) ---
// --- ************************************************* ---




// --- ************************************************* ---
// --- GÜNCELLENDİ (YANA YÜRÜME, EĞİLEREK KAZMA, GOTO TOLERANSI) ---
// --- ************************************************* ---
async function placeLastCactus() {
    try {
        await this.randDelay(100, 300);
        
        // 1. ADIM: Hedefleri merkeze göre hafızaya al
        const currentBotPos = this.bot.entity.position.floored();
        const centerPos = vec3(this.cactusState.buildOrigin.x, currentBotPos.y, this.cactusState.buildOrigin.z);

        const digPos1 = centerPos.offset(0, -2, 0); // Kazılacak 1. blok (Merkez, Y-2)
        const digPos2 = centerPos.offset(0, -3, 0); // Kazılacak 2. blok (Merkez, Y-3)
        const placeRefOffset = [0, -4, 0]; 
        
        console.log(`[${this.config.username}] [placeLastCactus] Merkez pozisyon (Y:${centerPos.y}) hedefleri: Kaz1: ${digPos1}, Kaz2: ${digPos2}`);

        // 2. ADIM: Yana yürü (Zıpla)
        if (!this.cactusState.jumpPositions || this.cactusState.jumpPositions.length < 4) {
            throw new Error("placeLastCactus: jumpPositions (DirtLayer) eyalette bulunamadı!");
        }
        
        const savedJumpPositions = this.cactusState.jumpPositions.map(p => vec3(p.x, p.y, p.z));
        const randomSideBlock = savedJumpPositions[Math.floor(Math.random() * savedJumpPositions.length)];
        const targetWalkPos = vec3(randomSideBlock.x, currentBotPos.y, randomSideBlock.z);
        
        console.log(`[${this.config.username}] [placeLastCactus] Yana yürüme hedefi: ${targetWalkPos}`);
        
        // Oraya git (TOLERANS DÜZELTMESİ)
        // Tolerans 0.5'ten 1.5'e yükseltildi
        await this.bot.pathfinder.goto(new GoalNear(targetWalkPos.x, targetWalkPos.y, targetWalkPos.z, 1.5)); 
        await this.randDelay(400, 600); 

        // 3. ADIM: Hafızaya alınan (merkez) hedefleri kullanarak EĞİLEREK KAZ
        console.log(`[${this.config.username}] [placeLastCactus] Kenar pozisyondan EĞİLEREK KAZMA gerçekleştiriliyor...`);
        
        this.bot.setControlState('sneak', true); // <-- EĞİL
        await this.randDelay(100, 200); // Eğilmek için kısa bekleme

        try {
            await digWithShovelAndRetry.call(this, digPos1, "Son Kaktüs Kazma 1 (Yandan)"); 
            await this.randDelay(100, 300);
            await digWithShovelAndRetry.call(this, digPos2, "Son Kaktüs Kazma 2 (Yandan)");
        } catch (error) {
            console.error(`[${this.config.username}] [placeLastCactus] Eğilerek kazma sırasında hata:`, error.message);
            throw error; // Hatayı ana fonksiyona fırlat
        } finally {
            this.bot.setControlState('sneak', false); // <-- AYAĞA KALK (Hata olsa da olmasa da)
            await this.randDelay(100, 200);
        }
        
        // 4. ADIM: Merkeze geri dön
        const centerWalkPos = vec3(this.cactusState.buildOrigin.x, currentBotPos.y, this.cactusState.buildOrigin.z);
        console.log(`[${this.config.username}] [placeLastCactus] Kazma tamamlandı, merkeze dönülüyor: ${centerWalkPos}`);
        
        // (TOLERANS DÜZELTMESİ)
        // Tolerans 0.5'ten 1.5'e yükseltildi
        await this.bot.pathfinder.goto(new GoalNear(centerWalkPos.x, centerWalkPos.y, centerWalkPos.z, 1.5)); 
        await this.randDelay(400, 600); 
        
        console.log(`[${this.config.username}] [placeLastCactus] Merkeze dönüldü.`);

        // 5. ADIM: Merkezde, EĞİLEREK kaktüsü YERLEŞTİR
        console.log(`[${this.config.username}] [placeLastCactus] Son kaktüs eğilerek yerleştiriliyor...`);
        
        await this.randDelay(1800, 2200);
        await this.randDelay(400, 600);
        
        // retryAction içindeki equipAndPlace'e 'forceSneak = true' yolluyoruz
        await this.retryAction(() => equipAndPlace.call(
            this, 
            'cactus', 
            placeRefOffset, // [0, -4, 0] 
            [0, 1, 0],      // placeVec
            "Son Kaktüs Koyma (Eğilerek)", 
            null,           // targetBlockName
            true            // <-- 'forceSneak = true' komutu
        ), "Son Kaktüs Koyma (Eğilerek)");

        console.log(`[${this.config.username}] [placeLastCactus] Kaktüs yerleştirildi. Adım tamamlandı.`);

    } catch (error) { 
        console.error(`[${this.config.username}] Son kaktüs yerleştirme işlemi kalıcı olarak başarısız oldu:`, error.message); 
        this.bot.setControlState('sneak', false);
        throw error; 
    }
}









// --- GÖREVE DEVAM ETME (Kaktüs) ---
function checkDistanceAndRestartCactus(currentState) {
    // 'this' BotInstance'ı referans alır
    if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
    
    if (!this.bot || !this.bot.entity) {
        console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] Bot henüz tam spawn olmadı, 5sn bekleniyor.`);
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartCactus.call(this, currentState), 5000);
        return;
    }
    
    if (this.isBuilding || !this.cactusState) { 
        console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] Görev dışarıdan yönetildi. Bu kontrol iptal edildi.`);
        if(this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
        this.resumeCheckTimer = null;
        return;
    }

    const targetPos = vec3(currentState.buildOrigin.x, currentState.buildOrigin.y, currentState.buildOrigin.z);
    const distance = this.bot.entity.position.distanceTo(targetPos);
    console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] İnşaat alanına olan mesafe: ${distance.toFixed(2)} blok.`);

    const MAX_RESUME_DISTANCE = 100; 
    if (distance > MAX_RESUME_DISTANCE) {
        console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] İnşaat alanından çok uzakta (> ${MAX_RESUME_DISTANCE} blok). 10 saniye sonra tekrar kontrol...`);
        this.bot.pathfinder.stop(); 
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartCactus.call(this, currentState), 10000);
    } else {
        console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] İnşaat alanına yaklaşıldı (<= ${MAX_RESUME_DISTANCE} blok).`);
        console.log(`[${this.config.username}] [Durum Kontrol Kaktüs] Göreve (Kat ${currentState.currentLayer + 1}, Adım ${currentState.currentStepIndex + 1}) devam ediliyor.`);
       
        this.isBuilding = true;
        
        (async () => {
             try {
                await cactus.call(this, currentState);
                
                // Başarıyla biterse
                console.log(`[${this.config.username}] Kaktüs kulesi inşaası (devam) tamamlandı!`);
                this.deleteState(); 

            } catch (error) {
                if (error.message.includes('Görev durduruldu')) {
                    console.log(`[${this.config.username}] [Cactus] Devam etme görevi bir hatayla durdu (muhtemelen manuel):`, error.message);
                } else {
                    console.error(`[${this.config.username}] [Cactus] Devam etme görevi kalıcı bir hatayla durdu: ${error.message}`);
                    this.bot.quit('Kaktüs gorevi (devam) kalici hatayla durdu, yeniden baslatilacak.');
                }
            } finally {
                this.isBuilding = false;
                console.log(`[${this.config.username}] [Cactus] Devam etme görevi sonlandı (veya duraklatıldı).`);
            }
        })();
    }
}


// --- OTOMATİK SATIŞ ---
const itemsToSellConfig = {
    'cactus': 16, // 17. slot
};
const AUTO_SELL_INTERVAL_MS = 15000; 

function startAutoSellInterval() {
    // 'this' BotInstance'ı referans alır
    console.log(`[${this.config.username}] [OtoSatış] Otomatik satış döngüsü (15s) başlatıldı.`);
    
    return setInterval(() => {
        if (this.bot && this.bot.entity && !this.isBuilding && !this.isSelling && !this.isExcavating) {
            console.log(`[${this.config.username}] [OtoSatış] Bot boşta, satış için /çiftçi komutu yollanıyor...`);
            this.bot.chat('/çiftçi'); 
        }
    }, AUTO_SELL_INTERVAL_MS);
}

async function handleSellGUI(username, message) {
    // 'this' BotInstance'ı referans alır
    if (username === this.bot.username && message === '/çiftçi') {
        if (this.isSelling || this.isBuilding || this.isExcavating) {
            console.log(`[${this.config.username}] [Çiftçi] Bot meşgul. /çiftçi komutu yok sayılıyor.`);
            return;
        }

        this.isSelling = true; 
        console.log(`[${this.config.username}] [Çiftçi] /çiftçi komutu algılandı. Otomasyon başlıyor.`);
        
        try {
            const window = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('İlk GUI (27 slot) açılma zaman aşımı (10s)')), 10000);
                this.bot.once('windowOpen', (win) => {
                    clearTimeout(timeout);
                    resolve(win);
                });
            });

            if (window.slots.length >= 54) {
                throw new Error(`Açılan GUI (Slot: ${window.slots.length}) 27'lik menü değil.`);
            }
            console.log(`[${this.config.username}] [Çiftçi] LOG: Çiftçi menüsü açıldı.`);
            await this.randDelay(1000, 1500);

            const chestSlotIndex = 10; 
            console.log(`[${this.config.username}] [Çiftçi] LOG: Menüdeki cheste (Slot ${chestSlotIndex}) tıklanıyor...`);
            await this.retryAction(() => this.bot.clickWindow(chestSlotIndex, 0, 0), "Çiftçi Menüsü - Chest Tıklama");

            const sellWindow = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('İkinci (Satış) GUI açılma zaman aşımı (10s)')), 10000);
                this.bot.once('windowOpen', (win) => {
                    clearTimeout(timeout);
                    resolve(win);
                });
            });

            if (sellWindow.slots.length < 54) {
                throw new Error(`Beklenen Satış GUI açılmadı (Slot: ${sellWindow.slots.length})`);
            }
            console.log(`[${this.config.username}] [Çiftçi] LOG: Satış GUI açıldı.`);
            await this.randDelay(1000, 1500);

            let itemsSold = 0;
            for (const itemName in itemsToSellConfig) {
                const slotIndex = itemsToSellConfig[itemName];
                console.log(`[${this.config.username}] [Çiftçi] LOG: ${itemName} (Slot ${slotIndex}) satılıyor...`);
                await this.retryAction(
                    () => this.bot.clickWindow(slotIndex, 0, 0),
                    `Satış - ${itemName} (Slot ${slotIndex})`
                );
               itemsSold++;
                await this.randDelay(500, 800);
          }

            await this.randDelay(1000, 1500);
            console.log(`[${this.config.username}] [Çiftçi] Satış GUI kapatılıyor. İşlem tamamlandı.`);
            sellWindow.close();

        } catch (err) {
            console.error(`[${this.config.username}] [Çiftçi] Otomasyon hatası: ${err.message}`);
            if (this.bot.currentWindow) {
                console.log(`[${this.config.username}] [Çiftçi] Hata nedeniyle mevcut pencere kapatılıyor.`);
                this.bot.closeWindow(this.bot.currentWindow);
            }
         } finally {
            await this.randDelay(1000, 2000); 
            this.isSelling = false; 
            console.log(`[${this.config.username}] [Çiftçi] Otomasyon döngüsü tamamlandı.`);
        }
    }
}

module.exports = {
    startCactusTask,
    startAutoSellInterval,
    handleSellGUI,
    checkDistanceAndRestartCactus
};