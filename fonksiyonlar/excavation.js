const vec3 = require('vec3');
const { GoalNear } = require('mineflayer-pathfinder').goals;

// --- API İLE BAŞLATMA ---
async function startExcavateTask(bounds) {
    // 'this' BotInstance'ı referans alır
    if (this.resumeCheckTimer) {
        clearTimeout(this.resumeCheckTimer);
        this.resumeCheckTimer = null;
    }
    this.deleteState(); // Önceki görevi sil

    if (!this.bot || !this.bot.entity) throw new Error('Bot henüz oyuna girmedi.');
    if (this.isBusy()) throw new Error('Bot zaten meşgul.');

    // --- YENİ EKLENTİ: Diğer görevi temizle ---
    // Bir kazı görevi başladığında, eski kaktüs görevini
    // hafızadan ve dosyadan tamamen sil.
    console.log(`[${this.config.username}] [Excavate] Yeni kazı görevi için eski görevler (kaktüs) temizleniyor...`);
    this.isBuilding = false; 
    this.cactusState = null;
    // --- BİTİŞ ---

    const { min, max } = bounds;
    
    const initialState = {
        task: 'excavate',
        bounds: { min, max }, 
        lastPosition: { x: min.x, y: max.y, z: min.z } 
    };

    this.excavationState = initialState; 
    this.isExcavating = true;
    
    console.log(`[${this.config.username}] [Excavate] Yeni kazı görevi alındı (İstenen Max Y: ${max.y}). Alan taranıyor...`);
    
    // Görevi başlat
    startAndGoToExcavate.call(this, initialState); 
}

// --- GÖREVE GİTME VE TARAMA ---
async function startAndGoToExcavate(state) {
    // 'this' BotInstance'ı referans alır
    try {
        const { min, max } = state.bounds;

        let actualStartY = null;
        console.log(`[${this.config.username}] [Excavate] Alandaki en yüksek blok taranıyor (Max Y: ${max.y})...`);
        for (let y = max.y; y >= min.y; y--) {
            for (let x = min.x; x <= max.x; x++) {
                for (let z = min.z; z <= max.z; z++) {
                    const block = this.bot.blockAt(vec3(x, y, z));
                    if (block && block.name !== 'air' && block.name !== 'bedrock' && block.name !== 'barrier') {
                        actualStartY = y; 
                        break;
                    }
                }
                if (actualStartY !== null) break;
            }
            if (actualStartY !== null) break;
        }

        if (actualStartY === null) {
            console.log(`[${this.config.username}] [Excavate] Tüm alan boş (hava) veya chunk yüklenemedi. Görev iptal edildi.`);
            this.deleteState();
            this.isExcavating = false;
            return; 
        }
        console.log(`[${this.config.username}] [Excavate] En yüksek blok ${actualStartY} seviyesinde bulundu.`);
        
        const actualStartPos = { x: min.x, y: actualStartY, z: min.z };
        state.lastPosition = actualStartPos;
        if(this.excavationState) {
            this.excavationState.lastPosition = actualStartPos;
        }

        const startPosVec = vec3(actualStartPos.x, actualStartPos.y, actualStartPos.z);
        const GOAL_RADIUS = 1.5; 

        await this.retryAction(async () => {
            if (!this.isExcavating) throw new Error('Görev durduruldu (Web Arayüzü).');
            console.log(`[${this.config.username}] [Excavate] Anti-cheat gecikmesi (500ms) bekleniyor...`);
            await this.randDelay(500, 700); 

            if (this.bot.entity.position.distanceTo(startPosVec) > GOAL_RADIUS) {
                console.log(`[${this.config.username}] [Excavate] Başlangıç noktasına (${startPosVec}) gidiliyor...`);
                await this.bot.pathfinder.goto(new GoalNear(startPosVec.x, startPosVec.y, startPosVec.z, GOAL_RADIUS));
            } else {
                console.log(`[${this.config.username}] [Excavate] Zaten başlangıç noktasındayız. 'goto' atlanıyor.`);
            }
        }, `Başlangıç noktasına git`);

        if (!this.isExcavating) throw new Error('Görev durduruldu (Web Arayüzü).');

        console.log(`[${this.config.username}] [Excavate] Alana ulaşıldı. Kazı başlıyor.`);
        await excavate.call(this, state); // 'this' bağlamıyla çağır

    } catch (err) {
        if (err.message.includes('Görev durduruldu') || err.name === 'path_stopped') {
            console.log(`[${this.config.username}] [Excavate] Alana gidiş veya kazı, kullanıcı tarafından durduruldu.`);
        } else {
            console.error(`[${this.config.username}] [Excavate] Görev kalıcı bir hata nedeniyle durduruldu: ${err.message}`);
        }
    } finally {
        this.isExcavating = false; 
        console.log(`[${this.config.username}] [Excavate] Görev (startAndGoToExcavate) tamamlandı veya durduruldu.`);
    }
}

// --- ANA KAZI DÖNGÜSÜ ---

// --- ANA KAZI DÖNGÜSÜ ---
async function excavate(state) {
    // 'this' BotInstance'ı referans alır
    try {
        const { min, max } = state.bounds;
        for (let y = state.lastPosition.y; y >= min.y; y--) {
            let startZ = state.lastPosition.z;
            let startX = state.lastPosition.x;
            for (let z = startZ; z <= max.z; z++) {
                for (let x = startX; x <= max.x; x++) {
                    if (!this.isExcavating) {
                        state.lastPosition = { x, y, z };
                        this.excavationState = state;
                        throw new Error('Görev durduruldu (Web Arayüzü).');
                    }
                    
                    // --- GÖREVDE YEMEK YEME ---
                    await this.checkAndEat(true);
                    // --- BİTİŞ ---

                    const blockPos = vec3(x, y, z);
                    const block = this.bot.blockAt(blockPos);
                    const airTypes = ['air', 'bedrock', 'barrier', 'cave_air', 'void_air'];
                    
                    if (block && !airTypes.includes(block.name)) {
                        
                        await this.retryAction(async () => {
                            if (this.bot.entity.position.distanceTo(blockPos) > 2.5) { 
                                console.log(`[${this.config.username}] [Excavate Log] Yaklaşılıyor: ${blockPos}`);
                                await this.bot.pathfinder.goto(new GoalNear(blockPos.x, blockPos.y, blockPos.z, 1.5)); 
                            }
                            if (!this.isExcavating) throw new Error('Görev durduruldu (Web Arayüzü).');
                            
                            const targetBlock = this.bot.blockAt(blockPos);
                            if (!targetBlock || airTypes.includes(targetBlock.name)) {
                                console.log(`[${this.config.username}] [Excavate Log] ${blockPos} bloğu atlanıyor (artık hava).`);
                                return;
                            }
                            
                            console.log(`[${this.config.username}] [Excavate Log] KAZMA BAŞLANGIÇ: ${targetBlock.name} @ ${blockPos}`);
                            
                            // 1. EKİPMAN LOGU
                            await this.bot.tool.equipForBlock(targetBlock, {});
                            console.log(`[${this.config.username}] [Excavate Log] Alet kuşanıldı: ${this.bot.heldItem ? this.bot.heldItem.name : 'Boş El'}`);
                            await this.randDelay(100, 200);

                            // 2. BAKMA LOGU
                            const lookPos = targetBlock.position.offset(0.5, 0.5, 0.5); 
                            await this.bot.lookAt(lookPos, true);
                            console.log(`[${this.config.username}] [Excavate Log] Bloğa bakıldı: ${lookPos}`);
                            await this.randDelay(100, 200);

                            // 3. KAZMA API LOGU
                            await this.bot.dig(targetBlock);
                            console.log(`[${this.config.username}] [Excavate Log] mineflayer.dig() çağrıldı.`);
                            
                            // 4. SUNUCU CEVABI BEKLEME
                            await this.randDelay(400, 600);
                            
                            // 5. DOĞRULAMA DÖNGÜSÜ
                            let verificationTries = 0;
                            const maxVerifTries = 5; 
                            const checkInterval = 300; 
                            let breakSuccessful = false;

                            while (verificationTries < maxVerifTries) {
                                const currentBlock = this.bot.blockAt(blockPos);
                                if (currentBlock && airTypes.includes(currentBlock.name)) {
                                    console.log(`[${this.config.username}] [Excavate Log] KAZMA BAŞARILI! Blok hava olarak doğrulandı.`);
                                    breakSuccessful = true;
                                    break; 
                                }
                                verificationTries++;
                                console.warn(`[${this.config.username}] [Excavate Log] Doğrulama ${verificationTries}/${maxVerifTries}... Blok: ${currentBlock ? currentBlock.name : 'null'}`);
                                await this.randDelay(checkInterval, checkInterval + 50);
                            }

                            if (!breakSuccessful) {
                                throw new Error(`Blok ${maxVerifTries} denemeden sonra kırılamadı (sunucu reddetti?).`);
                            }


                        }, `Git ve Kaz: ${block.name} (${blockPos})`);
                        
                        state.lastPosition = { x, y, z };
                        this.excavationState = state;
                    }
                }
                startX = min.x;
            }
            startZ = min.z;
            state.lastPosition = { x: min.x, y: y - 1, z: min.z };
            this.excavationState = state;
        }
        console.log(`[${this.config.username}] [Excavate] Alanın kazılması tamamlandı!`);
        this.deleteState(); // Görev bitti, state dosyasını sil

    } catch (error) {
        if (this.isExcavating) {
           throw error; 
        }
    }
}


// --- GÖREVE DEVAM ETME (Uzaklık Kontrolü) ---
function checkDistanceAndRestart(currentState) {
    // 'this' BotInstance'ı referans alır
    if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
    
    if (!this.bot || !this.bot.entity) {
        console.log(`[${this.config.username}] [Durum Kontrol] Bot henüz tam spawn olmadı, 5sn bekleniyor.`);
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestart.call(this, currentState), 5000);
        return;
    }
    
    if (this.isExcavating || !this.excavationState) { 
        console.log(`[${this.config.username}] [Durum Kontrol] Görev dışarıdan yönetildi. Bu kontrol iptal edildi.`);
        if(this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);
        this.resumeCheckTimer = null;
        return;
    }

    const { min, max } = currentState.bounds;
    const targetPos = vec3((min.x + max.x) / 2, max.y, (min.z + max.z) / 2);
    const distance = this.bot.entity.position.distanceTo(targetPos);
    console.log(`[${this.config.username}] [Durum Kontrol] Kazı alanına olan mesafe: ${distance.toFixed(2)} blok.`);

    if (distance > 200) {
        console.log(`[${this.config.username}] [Durum Kontrol] Kazı alanından çok uzakta (> 200 blok). 15 saniye sonra tekrar kontrol...`);
        this.bot.pathfinder.stop(); 
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestart.call(this, currentState), 15000); 
    } else {
        console.log(`[${this.config.username}] [Durum Kontrol] Kazı alanına yaklaşıldı (<= 200 blok).`);
        console.log(`[${this.config.username}] [Durum Kontrol] Görev baştan başlatılıyor (Y-seviyesi yeniden taranacak).`);
        
        currentState.lastPosition = { x: min.x, y: max.y, z: min.z };
        this.excavationState = currentState; 
        this.isExcavating = true;
        
        startAndGoToExcavate.call(this, currentState); 
    }
}

module.exports = {
    startExcavateTask,
    checkDistanceAndRestart
};