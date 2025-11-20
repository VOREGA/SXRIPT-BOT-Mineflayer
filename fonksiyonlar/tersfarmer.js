// --- YENİ KOD (fonksiyonlar/farmer.js) ---

// 1. REQUIRE'lar (performance modülü düzeltildi)
const performance = require('perf_hooks').performance;
const vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));






// --- tersfarmer.js İÇİN startCactusTask ---
async function startCactusTask(totalLayers) {
    // 'this' BotInstance'ı referans alır
    if (this.isBuilding || this.isSelling || this.isExcavating || this.cactusState) {
        throw new Error('Bot zaten meşgul (inşaat, satış, kazı veya devam eden kaktüs görevi var).');
    }
    
    // Malzeme Kontrolü (TERSFARMER - NORMAL ORANLAR)
    const cactusPerLayer = 31;
    const sandPerLayer = 24;        
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
            console.log(`[${this.config.username}] (Ters/Normal) oranlarına göre şu malzemeleri alırsanız:`);
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
        const errorMessage = `Gerekli itemler eksik. Lütfen envanterinizi kontrol edin:
        Kaktüs (cactus): ${cactusCount}/${totalCactus}
        Kum (sand): ${sandCount}/${totalSand}
        İp (string): ${stringCount}/${totalString}
        İskele (scaffolding): ${scaffoldingCount}/${totalScaffolding}`;
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
		subType: 'ters',
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
        // --- 2. Kat (Bot Y=0'da başlar) ---
        
        // 1. Kumları koy (Zemin)
        { name: 'koykum',      func: koykum.bind(this) },     // Kum ve 8 dış kaktüs (Y=0 ve Y=1'e koyar)
		{ name: 'koyip',      func: koyip.bind(this) },     // Kum ve 8 dış kaktüs (Y=0 ve Y=1'e koyar)
		{ name: 'digkum',      func: digkum.bind(this) },     // Kum ve 8 dış kaktüs (Y=0 ve Y=1'e koyar)
		
        { name: 'kumkatmani1', func: kumkatmani1.bind(this) },
        { name: 'kumkatmani2', func: kumkatmani2.bind(this) },
        
        // --- Yükselme (Kat 1 -> Kat 2) ---
        { name: 'firstblocksand', func: firstblocksand.bind(this) },
        
        // 3. Kaktüsleri koy (Y=1'de)
        { name: 'cackatmani21', func: cackatmani21.bind(this) },
        { name: 'cackatmani2', func: cackatmani2.bind(this) },
        { name: 'ipkatmani3', func: ipkatmani3.bind(this) },
        { name: 'cackatmani3', func: cackatmani3.bind(this) },
        { name: 'ipkatmani4', func: ipkatmani4.bind(this) },
        
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






// --- farmer.js içindeki mevcut equipAndPlace fonksiyonu yerine yapıştırın ---


// --- equipAndPlace fonksiyonunu bu kodla DEĞİŞTİRİN (NİHAİ KAKTÜS DESTEKLİ VERSİYON) ---
async function equipAndPlace(itemName, refOffset, placeVec, actionName, targetBlockName = null, forceSneak = false) {
    // 'this' BotInstance'ı referans alır
    
    // 1. targetBlockName'i ayarla
    targetBlockName = targetBlockName || itemName; 
    
    const item = this.bot.inventory.items().find(i => i.name === itemName);
    if (!item) { throw new Error(`[equipAndPlace] Envanterde ${itemName} bulunamadı!`); }
    
    const botPos = getMasterBuildPos.call(this); // Botun sabitlenmiş X/Z'deki mevcut Y pozisyonu
    
    let refBlock = null; // Tıklanacak Referans Blok
    let finalPlaceVec = vec3(placeVec[0], placeVec[1], placeVec[2]); // placeBlock'a verilecek yüzey vektörü
    
    // 1. ADIM: Orijinal Referans Bloğu Kontrol Et (Kum/Dirt olması beklenir)
    const initialRefPos = botPos.offset(refOffset[0], refOffset[1], refOffset[2]);
    let initialRefBlock = this.bot.blockAt(initialRefPos);
    
    const targetPos = initialRefPos.plus(finalPlaceVec); // Koyulacak Bloğun Mutlak Konumu (Her zaman aynı kalır)
    
    // --- 2. Referans Blok Bulma Mantığı ---
    if (initialRefBlock && initialRefBlock.name !== 'air') {
        // A) ORİJİNAL BLOK VAR VE KATI (EN İYİ DURUM)
        refBlock = initialRefBlock;
        console.log(`[${this.config.username}] [Ref] ORİJİNAL Referans Blok Kullanıldı: ${refBlock.name}`);
    } else {
        // B) ORİJİNAL BLOK YOK (HAVA). YEDEK BLOK ARA.
        console.warn(`[${this.config.username}] [Ref] Orijinal referans blok (${initialRefPos}) HAVA. Yedek aranıyor (Hedef: ${targetPos})...`);
        
        // TargetPos'un çevresindeki tüm komşuları kontrol et
        const neighbors = [
            [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], // Doğrudan komşular
            [1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0], [0, 1, 1], [0, 1, -1], [0, -1, 1], [0, -1, -1], // Köşeler
        ];
        
        for (const [dx, dy, dz] of neighbors) {
            const potentialRefPos = targetPos.offset(dx, dy, dz);
            const potentialRefBlock = this.bot.blockAt(potentialRefPos);
            
            // Tıklanabilir blok kontrolü: Hava değil VE tehlikeli olmayan bir blok (örneğin su, ip değil)
            const isClickableBlock = potentialRefBlock && potentialRefBlock.name !== 'air' && 
                                     !['tripwire', 'string', 'water', 'lava'].includes(potentialRefBlock.name);

            if (isClickableBlock) {
                 // Kaktüs, Sand, Dirt vb. blokları kabul et
                 refBlock = potentialRefBlock;
                 // Yeni yüzey vektörünü hesapla: (Koyulacak yer - Tıklanacak yer)
                 finalPlaceVec = targetPos.minus(refBlock.position);
                 console.log(`[${this.config.username}] [Ref] YEDEK Referans Blok BULUNDU: ${refBlock.name} at ${refBlock.position}. Yeni Vektör: [${finalPlaceVec.x}, ${finalPlaceVec.y}, ${finalPlaceVec.z}]`);
                 break; // İlk bulunan katı/kaktüs bloğu kullan ve döngüden çık
            }
        }

        if (!refBlock) {
             console.error(`[equipAndPlace HATA] ${actionName} başarısız: Referans blok (${initialRefPos}) Hava VE yedek blok bulunamadı!`); 
             throw new Error(`Referans blok Hava, yedek yerleştirme bloğu bulunamadı. Yerleştirme yapılamaz.`);
        }
    }
    // --- Referans Blok Bulma Bitti ---
    
    
    // 3. Yerleştirme Ön Kontrolleri
    const blockAtTarget = this.bot.blockAt(targetPos);
    if (blockAtTarget && blockAtTarget.name === targetBlockName) {
        console.log(`[${this.config.username}] [Skip] ${actionName} bloğu (${targetBlockName}) zaten yerinde.`);
        return;
    }

    // --- Loglar ve Eylem ---
    console.log(`[${this.config.username}] [Coords] '${actionName}' (Yerleştirme) | Hedef: ${targetPos} | Tıklanacak: ${refBlock.position}`);
    
    try {
        await this.bot.equip(item, "hand");
        await this.randDelay(100, 300); 
        
        const willSneak = forceSneak || Math.random() < 0.4; 
        
        if (willSneak) {
            this.bot.setControlState('sneak', true);
            await this.randDelay(50, 100);
        }
        
        // --- Yerleştirme Eylemi ---
        // Artık finalPlaceVec'i kullanıyoruz!
        await this.bot.placeBlock(refBlock, finalPlaceVec);
        await this.randDelay(50, 100); 
        
        if (willSneak) {
            this.bot.setControlState('sneak', false);
        }
        
        console.log("-----------------------------------------");
        console.log(`[YERLEŞTİRME BAŞARILI] '${actionName}' tamamlandı.`);
        console.log(`[REF BLOK LOGU] Tıklanan Referans Blok: ${refBlock.name} | Mutlak Konum: ${refBlock.position.x} ${refBlock.position.y} ${refBlock.position.z}`);
        console.log(`[YÜZEY LOGU] Tıklanan Yüzey Vektörü (placeVec): [${finalPlaceVec.x}, ${finalPlaceVec.y}, ${finalPlaceVec.z}]`);
        console.log(`[HEDEF LOGU] Koyulan Mutlak Konum: ${targetPos.x} ${targetPos.y} ${targetPos.z}`);
        console.log("-----------------------------------------");

        await this.randDelay(250, 300); 

        // --- DOĞRULAMA DÖNGÜSÜ ---
        let verificationTries = 0;
        const maxTries = 10; 
        const checkInterval = 500; 
        let lastFoundBlockName = 'null (boş)'; 

        while (verificationTries < maxTries) {
            const currentBlock = this.bot.blockAt(targetPos);
            lastFoundBlockName = currentBlock ? currentBlock.name : 'null (boş)'; 

            if (currentBlock && currentBlock.name === targetBlockName) {
                console.log(`[${this.config.username}] [Coords] '${actionName}' (Yerleştirme) | BAŞARILI. Blok '${targetBlockName}' olarak doğrulandı.`);
                return; 
            }
            
            verificationTries++;
            
            console.warn(`[${this.config.username}] [Coords] '${actionName}' (Doğrulama) | Deneme ${verificationTries}/${maxTries}: Aranan: '${targetBlockName}', Bulunan: '${lastFoundBlockName}'`);
            
            await this.randDelay(checkInterval, checkInterval + 100);
        }

        throw new Error(`Blok ${maxTries} denemeden sonra yerleştirilemedi. Aranan: '${targetBlockName}', Son denemede bulunan: '${lastFoundBlockName}'`);

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

 








// --- ************************************************* ---
// --- GÜNCELLENDİ (Rotasyon Hatası ve Çökme Düzeltmesi) ---
// --- ************************************************* ---
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




//new functions area
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
            { id: 'Sand 8', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -2], [0, 1, 0], "Sand 8"), "Sand 8") },
			{ id: 'Sand 9', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, -1], [0, 1, 0], "Sand 9"), "Sand 9") },
			{ id: 'Sand 10', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, -1], [0, 1, 0], "Sand 10"), "Sand 10") },
			{ id: 'Sand 11', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 1], [0, 1, 0], "Sand 11"), "Sand 11") },
			{ id: 'Sand 12', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 1], [0, 1, 0], "Sand 12"), "Sand 12") }
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


//[1, 0, 0] = Doğu (+X) yüzeyine tıkla east önce buildlayer sonra ip1 sonra cac1 sonra ip2



//[-1, 0, 0] = Batı (-X) yüzeyine tıkla west



//[0, 0, 1] = Güney (+Z) yüzeyine tıkla south



//[0, 0, -1] = Kuzey (-Z) yüzeyine tıkla north



//[0, 1, 0] = Üst (+Y) yüzeyine tıkla



//[0, -1, 0] = Alt (-Y) yüzeyine tıkla




// --- GÜNCELLENDİ (tripwire ve forceSneak eklendi) ---

async function ipkatmani1() {
    try {
        const ipTasks = [
            // --- Referans Blok: [0, 1, 2] (Eski Kaktüs 3) ---
            { id: 'İp 1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, 2], [-1, 0, 0], "İp 1a", 'tripwire', true), "İp 1a") },
            { id: 'İp 1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, 2], [1, 0, 0], "İp 1b", 'tripwire', true), "İp 1b") },

            // --- Referans Blok: [0, 1, -2] (Eski Kaktüs 7) ---
            { id: 'İp 2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, -2], [-1, 0, 0], "İp 2a", 'tripwire', true), "İp 2a") },
            { id: 'İp 2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, 1, -2], [1, 0, 0], "İp 2b", 'tripwire', true), "İp 2b") },

            // --- Referans Blok: [2, 1, 0] (Eski Kaktüs 1) ---
            { id: 'İp 3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 1, 0], [0, 0, -1], "İp 3a", 'tripwire', true), "İp 3a") },
            { id: 'İp 3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 1, 0], [0, 0, 1], "İp 3b", 'tripwire', true), "İp 3b") },

            // --- Referans Blok: [-2, 1, 0] (Eski Kaktüs 5) ---
            { id: 'İp 4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 1, 0], [0, 0, -1], "İp 4a", 'tripwire', true), "İp 4a") },
            { id: 'İp 4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 1, 0], [0, 0, 1], "İp 4b", 'tripwire', true), "İp 4b") }
        ];

        await runShuffledTasks.call(this, ipTasks, 'ipkatmani1 (string)');

    } catch (error) {
        console.error(`[${this.config.username}] ipkatmani1 oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}

// --- farmer.js dosyasındaki deneme1 fonksiyonunu bu kodla DEĞİŞTİR ---


// --- farmer.js dosyasındaki async function deneme1() { ... } bloğunun tamamını bu kodla DEĞİŞTİRİN ---

async function deneme1() { 
    try {
        // Tek bir blok yerleştirme görevi (Son başarılı testinize göre ayarlandı)
        const DenemeTasks = [
            { 
                id: 'deneme1_sade', 
                func: () => this.retryAction(
                    // Yön: +Z (Güney) yüzeyine, 'string' yerleştir ve 'tripwire' olarak doğrula.
                    () => equipAndPlace.call(this, 'string', [2, 1, 1], [0, 0, 1], "string (tripwire)", 'tripwire'), 
                    "string (tripwire)"
                ) 
            }
        ];

        // runShuffledTasks'i kullanarak tek görevli listeyi çalıştır
        await runShuffledTasks.call(this, DenemeTasks, 'deneme (sade)');
        
        console.log(`[${this.config.username}] Sadeleştirilmiş Deneme 1 başarıyla tamamlandı.`);

    } catch (error) { 
        console.error(`[${this.config.username}] Deneme 1 kalıcı olarak başarısız oldu:`, error.message); 
        throw error; 
    }
}



// NOT: Yukarıdaki kodda artık DenemeTasks ve runShuffledTasks kullanmıyoruz, 
// çünkü bu, bir döngü içinde manuel olarak yapılıyor.

async function cackatmani1() {
    try {
        const CacTasks = [
     		{ id: 'Cactus 1', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, 0, -1], [0, 1, 0], "cac 1"), "cac 1") },
			{ id: 'Cactus 2', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, 0, -1], [0, 1, 0], "cac 2"), "cac 2") },
			{ id: 'Cactus 3', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, 0, 1], [0, 1, 0], "cac 3"), "cac 3") },
			{ id: 'Cactus 4', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, 0, 1], [0, 1, 0], "cac 3"), "cac 4") }
        ];

        await runShuffledTasks.call(this, CacTasks, 'cackatmani1 (cactus)');

    } catch (error) {
        console.error(`[${this.config.username}] CacTasks oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}






async function ipkatmani2() {
    try {
        const ip2Tasks = [
            // İtem: 'string', Aranan Blok: 'tripwire'
            { id: 'İp 1 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, 1], [-1, 0, 0], "İp 1 (Ara)", 'tripwire', true), "İp 1 (Ara)") },

            // İtem: 'string', Aranan Blok: 'tripwire'
            { id: 'İp 2 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, 1], [0, 0, -1], "İp 2 (Ara)", 'tripwire', true), "İp 2 (Ara)") },

            // İtem: 'string', Aranan Blok: 'tripwire'
            { id: 'İp 3 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, 1, -1], [-1, 0, 0], "İp 3 (Ara)", 'tripwire', true), "İp 3 (Ara)") },

            // İtem: 'string', Aranan Blok: 'tripwire'
            { id: 'İp 4 (Ara)', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, 1, 1], [0, 0, -1], "İp 4 (Ara)", 'tripwire', true), "İp 4 (Ara)") }
        ];

        await runShuffledTasks.call(this, ip2Tasks, 'ipkatmani2 (string)');

    } catch (error) {
        console.error(`[${this.config.username}] ipkatmani2 oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}








// --- YENİ FONKSİYON 1 (ipkatmani1 İplerinin Üstüne Kum) ---
async function kumkatmani1() {
    try {
        // ipkatmani1'in ipleri [±1, -1, ±2], [±2, -1, ±1] koordinatlarındaydı.
        // Onların üstüne [0, 1, 0] ile kum koyuyoruz.
        const sandTasks = [
            { id: 'Kum 1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 2], [0, 1, 0], "Kum 1a (ip1 üstü)"), "Kum 1a") },
            { id: 'Kum 1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 2], [0, 1, 0], "Kum 1b (ip1 üstü)"), "Kum 1b") },
            { id: 'Kum 2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, -2], [0, 1, 0], "Kum 2a (ip1 üstü)"), "Kum 2a") },
            { id: 'Kum 2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, -2], [0, 1, 0], "Kum 2b (ip1 üstü)"), "Kum 2b") },
            { id: 'Kum 3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -1], [0, 1, 0], "Kum 3a (ip1 üstü)"), "Kum 3a") },
            { id: 'Kum 3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 1], [0, 1, 0], "Kum 3b (ip1 üstü)"), "Kum 3b") },
            { id: 'Kum 4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -1], [0, 1, 0], "Kum 4a (ip1 üstü)"), "Kum 4a") },
            { id: 'Kum 4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 1], [0, 1, 0], "Kum 4b (ip1 üstü)"), "Kum 4b") }
        ];
        await runShuffledTasks.call(this, sandTasks, 'kumkatmani1');
    } catch (error) { console.error(`[${this.config.username}] kumkatmani1 işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}

// --- YENİ FONKSİYON 2 (ipkatmani2 İplerinin Üstüne Kum) ---
async function kumkatmani2() {
    try {
        // ipkatmani2 ipleri (4 ara) [0, -1, ±1], [±1, -1, 0] koordinatlarındaydı.
        // Onların üstüne [0, 1, 0] ile kum koyuyoruz.
        const sandTasks = [
            { id: 'Kum 2-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, 1], [0, 1, 0], "Kum 2-1 (ip2 üstü)"), "Kum 2-1") },
            { id: 'Kum 2-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [1, -1, 0], [0, 1, 0], "Kum 2-2 (ip2 üstü)"), "Kum 2-2") },
            { id: 'Kum 2-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [0, -1, -1], [0, 1, 0], "Kum 2-3 (ip2 üstü)"), "Kum 2-3") },
            { id: 'Kum 2-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-1, -1, 0], [0, 1, 0], "Kum 2-4 (ip2 üstü)"), "Kum 2-4") }
        ];
        await runShuffledTasks.call(this, sandTasks, 'kumkatmani2');
    } catch (error) { console.error(`[${this.config.username}] kumkatmani2 işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}





//son1



// --- YENİ FONKSİYON 3 (DÜZELTİLDİ - Doğru refOffset) ---
async function cackatmani21() {
    try {
        // kumkatmani1 kumları [±1, 0, ±2], [±2, 0, ±1] koordinatlarındadır (bot'a göre)
        // Onların üstüne [0, 1, 0] ile kaktüs koyuyoruz.
        const cactusTasks = [
            { id: 'Kaktüs 2-1a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, -1, 1], [0, 1, 0], "Kaktüs 2-1a", null, true), "Kaktüs 2-1a") }, //1
            { id: 'Kaktüs 2-2b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, -1, 1], [0, 1, 0], "Kaktüs 2-2b", null, true), "Kaktüs 2-2b") }, //2
            { id: 'Kaktüs 2-3b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [2, -1, -1], [0, 1, 0], "Kaktüs 2-3b", null, true), "Kaktüs 2-3b") }, //4
            { id: 'Kaktüs 2-4a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-2, -1, -1], [0, 1, 0], "Kaktüs 2-4a", null, true), "Kaktüs 2-4a") } //3
        ];
        await runShuffledTasks.call(this, cactusTasks, 'cackatmani2');
    } catch (error) { console.error(`[${this.config.username}] cackatmani2 işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}



// --- YENİ FONKSİYON 3 (DÜZELTİLDİ - Doğru refOffset) ---
async function cackatmani2() {
    try {
        // kumkatmani1 kumları [±1, 0, ±2], [±2, 0, ±1] koordinatlarındadır (bot'a göre)
        // Onların üstüne [0, 1, 0] ile kaktüs koyuyoruz.
        const cactusTasks = [
            { id: 'Kaktüs 2-1b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, 2], [0, 1, 0], "Kaktüs 2-1b", null, true), "Kaktüs 2-1b") },
            { id: 'Kaktüs 2-2a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, 2], [0, 1, 0], "Kaktüs 2-2a", null, true), "Kaktüs 2-2a") },
            { id: 'Kaktüs 2-3a', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, -2], [0, 1, 0], "Kaktüs 2-3a", null, true), "Kaktüs 2-3a") },
            { id: 'Kaktüs 2-4b', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, -2], [0, 1, 0], "Kaktüs 2-4b", null, true), "Kaktüs 2-4b") }
        ];
        await runShuffledTasks.call(this, cactusTasks, 'cackatmani2');
    } catch (error) { console.error(`[${this.config.username}] cackatmani2 işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}

// --- YENİ FONKSİYON 6 (DÜZELTİLDİ - Doğru refOffset) ---
async function cackatmani3() {
    try {
        // kumkatmani2 kumları [0, 0, ±1], [±1, 0, 0] koordinatlarındadır (bot'a göre)
        // Onların üstüne [0, 1, 0] ile kaktüs koyuyoruz.
        const cactusTasks = [
            { id: 'Kaktüs 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [1, -1, 0], [0, 1, 0], "Kaktüs 3-1 (Kat2 İç)", null, true), "Kaktüs 3-1") },
            { id: 'Kaktüs 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, -1, 1], [0, 1, 0], "Kaktüs 3-2 (Kat2 İç)", null, true), "Kaktüs 3-2") },
            { id: 'Kaktüs 3-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [-1, -1, 0], [0, 1, 0], "Kaktüs 3-3 (Kat2 İç)", null, true), "Kaktüs 3-3") },
            { id: 'Kaktüs 3-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'cactus', [0, -1, -1], [0, 1, 0], "Kaktüs 3-4 (Kat2 İç)", null, true), "Kaktüs 3-4") }
        ];
        await runShuffledTasks.call(this, cactusTasks, 'cackatmani3');
    } catch (error) { console.error(`[${this.config.username}] cackatmani3 işlemi kalıcı olarak başarısız oldu:`, error.message); throw error; }
}


// --- YENİ FONKSİYON 7 (Scaffolding ile Yükselme) ---
async function buildUpScaffolding() { 
    // jumpAndPlace fonksiyonunu 'scaffolding' ile çağırır
    await jumpAndPlace.call(this, 'scaffolding', 'buildUpScaffolding'); 
}


async function koykum() {
    try {
        // Kum katmanındaki dış köşelere (örn: [2, 0, 2]) ip koymak için.
        // İp, kaktüsün yanına yerleştirilecektir. Kaktüsler, kumların üstünde Y=1'deydi.
        // Bot şu an Y=2'de, yani kumlar Y=0'da, kaktüsler Y=1'dedir.
        
        const KoyTasks = [
            { id: 'İp 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, -2], [0, 1, 0], "İp 3-1", 'sand', true), "İp 3-1") }, //4
            { id: 'İp 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, -2], [0, 1, 0], "İp 3-2", 'sand', true), "İp 3-2") }, //1
            { id: 'İp 3-5', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [2, -1, 2], [0, 1, 0], "İp 3-5", 'sand', true), "İp 3-5") }, //2
            { id: 'İp 3-7', func: () => this.retryAction(() => equipAndPlace.call(this, 'sand', [-2, -1, 2], [0, 1, 0], "İp 3-7", 'sand', true), "İp 3-7") } //3
        ];

        await runShuffledTasks.call(this, KoyTasks, 'koykum');

    } catch (error) {
        console.error(`[${this.config.username}] koysonrakir oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}







async function koyip() {
    try {
        // Kum katmanındaki dış köşelere (örn: [2, 0, 2]) ip koymak için.
        // İp, kaktüsün yanına yerleştirilecektir. Kaktüsler, kumların üstünde Y=1'deydi.
        // Bot şu an Y=2'de, yani kumlar Y=0'da, kaktüsler Y=1'dedir.
        
        const koyip = [
            { id: 'İp 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 0, -2], [0, 1, 0], "İp 3-1", 'tripwire', true), "İp 3-1") }, //4
            { id: 'İp 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 0, -2], [0, 1, 0], "İp 3-2", 'tripwire', true), "İp 3-2") }, //1
            { id: 'İp 3-5', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, 0, 2], [0, 1, 0], "İp 3-5", 'tripwire', true), "İp 3-5") }, //2
            { id: 'İp 3-7', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, 0, 2], [0, 1, 0], "İp 3-7", 'tripwire', true), "İp 3-7") } //3
        ];

        await runShuffledTasks.call(this, koyip, 'koyip');

    } catch (error) {
        console.error(`[${this.config.username}] koyip oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}










async function digkum() {
    console.log(`[${this.config.username}] [digkum] Kum koyma pozisyonlarını kazma işlemi başlıyor...`);
    this.bot.setControlState('sneak', true); // <-- EĞİL
    await this.randDelay(100, 200); // Eğilmek için bekle

    try {
        // Botun gerçek konumu baz alınacak
        const botPos = this.bot.entity.position.floored();

        // koykum fonksiyonundaki kum (sand) bloklarının yerleştirildiği tam pozisyonlar:
        // Y seviyesi -1'de (Bot Y=2'de ise, burası Y=1 seviyesidir. Kaktüslerin konduğu yer.)
        const pos1 = botPos.offset(-2, 0, -2);
        const pos2 = botPos.offset(2, 0, -2);
        const pos3 = botPos.offset(2, 0, 2);
        const pos4 = botPos.offset(-2, 0, 2);

        // Kırma görevleri: digWithShovelAndRetry kullanılarak
        const tasks = [
            // Orijinal koykum görev sırasını takip etmek için id'ler aynı tutulmuştur:
            { id: 'kum dig 3-1', func: () => digWithShovelAndRetry.call(this, pos1, 'digkum 3-1') }, // [-2, -1, -2]
            { id: 'kum dig 3-2', func: () => digWithShovelAndRetry.call(this, pos2, 'digkum 3-2') }, // [2, -1, -2]
            { id: 'kum dig 3-5', func: () => digWithShovelAndRetry.call(this, pos3, 'digkum 3-5') }, // [2, -1, 2]
            { id: 'kum dig 3-7', func: () => digWithShovelAndRetry.call(this, pos4, 'digkum 3-7') }  // [-2, -1, 2]
        ];

        // Görev sırasını rastgeleleştir ve çalıştır
        await runShuffledTasks.call(this, tasks, 'digkum');
        
        console.log(`[${this.config.username}] [digkum] Kum koyma pozisyonları kazma tamamlandı.`);

    } catch (error) {
        console.error(`[${this.config.username}] Kum kazma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error; // Hatayı fırlat
    } finally {
        this.bot.setControlState('sneak', false); // <-- AYAĞA KALK (Hata olsa da olmasa da)
        await this.randDelay(100, 200);
    }
}


async function ipkatmani31() {
    try {
        // Kum katmanındaki dış köşelere (örn: [2, 0, 2]) ip koymak için.
        // İp, kaktüsün yanına yerleştirilecektir. Kaktüsler, kumların üstünde Y=1'deydi.
        // Bot şu an Y=2'de, yani kumlar Y=0'da, kaktüsler Y=1'dedir.
        
        const ipTasks = [
            { id: 'İp 3-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, -1, -2], [0, 1, 0], "İp 3-1", 'tripwire', true), "İp 3-1") }, //4
            { id: 'İp 3-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, -1, -2], [0, 1, 0], "İp 3-2", 'tripwire', true), "İp 3-2") }, //1
            { id: 'İp 3-5', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, -1, 2], [0, 1, 0], "İp 3-5", 'tripwire', true), "İp 3-5") }, //2
            { id: 'İp 3-7', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, -1, 2], [0, 1, 0], "İp 3-7", 'tripwire', true), "İp 3-7") } //3
        ];

        await runShuffledTasks.call(this, ipTasks, 'ipkatmani3 (Dış Köşe String)');

    } catch (error) {
        console.error(`[${this.config.username}] ipkatmani3 oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}


// --- YENİ FONKSİYON 7 (ipkatmani3: Dış Köşelerdeki İpler) ---
async function ipkatmani3() {
    try {
        // Kum katmanındaki dış köşelere (örn: [2, 0, 2]) ip koymak için.
        // İp, kaktüsün yanına yerleştirilecektir. Kaktüsler, kumların üstünde Y=1'deydi.
        // Bot şu an Y=2'de, yani kumlar Y=0'da, kaktüsler Y=1'dedir.
        
        const ipTasks = [
            { id: 'İp 3-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, -1, -2], [0, 1, 0], "İp 3-3", 'tripwire', true), "İp 3-3") }, 
            { id: 'İp 3-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [2, -1, 0], [0, 1, 0], "İp 3-4", 'tripwire', true), "İp 3-4") },
            { id: 'İp 3-6', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [0, -1, 2], [0, 1, 0], "İp 3-6", 'tripwire', true), "İp 3-6") }, 
            { id: 'İp 3-8', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-2, -1, 0], [0, 1, 0], "İp 3-8", 'tripwire', true), "İp 3-8") } 
        ];

        await runShuffledTasks.call(this, ipTasks, 'ipkatmani3 (Dış Köşe String)');

    } catch (error) {
        console.error(`[${this.config.username}] ipkatmani3 oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}

// --- YENİ FONKSİYON 8 (ipkatmani4: Dış Kenarlardaki İpler) ---
async function ipkatmani4() {
    try {
        // Kum katmanındaki dış kenarlara (örn: [2, 0, 0]) ip koymak için.
        // Kaktüsler, kumların üstünde Y=1'deydi. Bot Y=2'de.
        const ipTasks = [
            // Kenar: [2, 0, 0] (+X ekseninde)
            { id: 'İp 4-1', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, -1, 1], [0, 1, 0], "İp 4-1", 'tripwire', true), "İp 4-1") },
            { id: 'İp 4-2', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [1, -1, -1], [0, 1, 0], "İp 4-2", 'tripwire', true), "İp 4-2") }, 
            { id: 'İp 4-3', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, -1, 1], [0, 1, 0], "İp 4-3", 'tripwire', true), "İp 4-3") },
            { id: 'İp 4-4', func: () => this.retryAction(() => equipAndPlace.call(this, 'string', [-1, -1, -1], [0, 1, 0], "İp 4-4", 'tripwire', true), "İp 4-4") }
        ];

        await runShuffledTasks.call(this, ipTasks, 'ipkatmani4 (Dış Kenar String)');

    } catch (error) {
        console.error(`[${this.config.username}] ipkatmani4 oluşturma işlemi kalıcı olarak başarısız oldu:`, error.message);
        throw error;
    }
}


// lastcac
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




// --- farmer.js dosyasının en altına ekle ---
async function logPlaceCoords(itemName, referenceOffset, faceVector, actionName) {
    // 'this' BotInstance'ı referans alır
    
    // 1. Botun anlık konumunu merkez olarak al
    const botPos = this.bot.entity.position.floored();
    
    // 2. Tıklanacak Referans Bloğun Mutlak Konumunu Hesapla (Bu blok hali hazırda dünyada olmalı)
    const refBlockPos = botPos.offset(referenceOffset[0], referenceOffset[1], referenceOffset[2]); 
    const refBlock = this.bot.blockAt(refBlockPos);

    if (!refBlock || refBlock.name === 'air') {
        console.error(`[TEST LOG] HATA: Referans blok (${refBlockPos}) bulunamadı veya hava. Yerleştirme yapılamaz.`);
        return;
    }

    // 3. Koyulacak Bloğun Mutlak Konumunu Hesapla
    const placePos = refBlockPos.plus(vec3(faceVector[0], faceVector[1], faceVector[2]));
    
    // 4. Bot Konumuna Göre Nihai Vec3 Ofsetini Hesapla (Senin ihtiyacın olan değer)
    const finalVec3Offset = placePos.minus(botPos);

    console.log("-------------------------------------------------------------------------");
    console.log(`[TEST LOG BAŞARILI] İşlem: ${actionName}`);
    console.log(`[TEST LOG] Bot Konumu (Merkez): ${botPos.x} ${botPos.y} ${botPos.z}`);
    console.log(`[TEST LOG] Tıklanan Referans: ${refBlock.name} at ${refBlockPos}`);
    console.log(`[TEST LOG] Vec3 Ofseti (Koyulacak Blok): [${finalVec3Offset.x}, ${finalVec3Offset.y}, ${finalVec3Offset.z}]`);
    console.log(`[TEST LOG] Tıklanan Yüzey Vektörü: [${faceVector[0]}, ${faceVector[1]}, ${faceVector[2]}] (Bu, botun 'placeBlock'a verdiği parametredir)`);
    console.log(`[TEST LOG] Koyulacak Mutlak Konum: ${placePos}`);
    console.log("-------------------------------------------------------------------------");
    
    // İsteğe bağlı: Gerçekten koymak istersen bu satırı aç.
    // await this.retryAction(() => equipAndPlace.call(this, itemName, referenceOffset, faceVector, actionName), actionName);
}

// Lütfen bu fonksiyonu farmer.js'in module.exports'una ekle:
// module.exports = {
//     startCactusTask,
//     // ... diğer fonksiyonlar
//     logPlaceCoords // <--- Bunu ekle
// };






// --- farmer.js dosyasının en altı ---
module.exports = {
    startCactusTask,
    startAutoSellInterval,
    handleSellGUI,
    checkDistanceAndRestartCactus,
    logPlaceCoords // <--- BU SATIR EKLEMEK ZORUNLUDUR!
};