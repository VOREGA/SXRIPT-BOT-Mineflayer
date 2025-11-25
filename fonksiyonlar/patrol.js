const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const vec3 = require('vec3');

// Rastgele bekleme
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startPatrol(bounds) {
    // 'this' BotInstance'ı referans alır
    
    // 1. Durumu kaydet
    if (!this.patrolState) {
        this.patrolState = {
            task: 'patrol',
            bounds: bounds
        };
        this.saveState(); 
    }

    console.log(`[${this.config.username}] [Patrol] Devriye görevi aktif. Alan: X[${bounds.minX}~${bounds.maxX}] Z[${bounds.minZ}~${bounds.maxZ}]`);
    this.isPatrolling = true;

    // Pathfinder ayarlarını güncelle (Takılmaları önlemek için)
    // Eğer hedefe gidemezse daha hızlı pes etsin ve yeni hedef seçsin
    if (this.bot && this.bot.pathfinder) {
        this.bot.pathfinder.thinkTimeout = 5000; // Düşünme süresi sınırı
    }

    while (this.isPatrolling) {
        // Bot düşmüşse veya yoksa döngüyü kır
        if (!this.bot || !this.bot.entity) {
            console.log(`[${this.config.username}] [Patrol] Bot yok, döngü durduruluyor.`);
            break;
        }

        // --- 1. AÇLIK KONTROLÜ (YENİ) ---
        // BotInstance'daki otomatik yemek sistemi 'Meşgul' iken çalışmaz.
        // Bu yüzden burada manuel çağırıyoruz. true = Görevi duraklatarak ye.
        try {
            await this.checkAndEat(true);
        } catch (e) {
            console.error(`[${this.config.username}] [Patrol] Yemek yerken hata (önemsiz):`, e.message);
        }

        // Eğer yemek yerken patrol durdurulduysa döngüden çık
        if (!this.isPatrolling) break;


        // --- 2. HEDEF BELİRLEME ---
        const randomX = Math.floor(Math.random() * (bounds.maxX - bounds.minX + 1)) + bounds.minX;
        const randomZ = Math.floor(Math.random() * (bounds.maxZ - bounds.minZ + 1)) + bounds.minZ;
        
        // Yükseklik için botun olduğu seviyeyi veya varsa world height'ı al
        // Botun olduğu Y seviyesini hedeflemek en güvenlisidir, pathfinder yukarı/aşağı çözer.
        const currentY = this.bot.entity.position.y;
        
        console.log(`[${this.config.username}] [Patrol] Yeni hedef: X:${randomX} Z:${randomZ}`);

        try {
            // Önceki hedefleri temizle
            this.bot.pathfinder.setGoal(null);

            // Gitmeye çalış
            await this.bot.pathfinder.goto(new GoalNear(randomX, currentY, randomZ, 1));
            
            // --- 3. HEDEFE VARINCA YAPILACAKLAR ---
            // Sadece %30 ihtimalle zıplasın (Sürekli zıplarsa açlık hızlı düşer)
            if (Math.random() > 0.7) {
                this.bot.setControlState('jump', true);
                await sleep(300);
                this.bot.setControlState('jump', false);
            }
            
            // Biraz bekle (2 ile 5 saniye arası)
            const waitTime = Math.floor(Math.random() * 3000) + 2000;
            await sleep(waitTime);

        } catch (err) {
            // --- 4. HATA YAKALAMA (TAKILMAYI ÖNLER) ---
            // Eğer yol bulamazsa veya takılırsa buraya düşer.
            // Döngüyü kırmıyoruz, sadece loglayıp yeni hedef seçiyoruz.
            console.warn(`[${this.config.username}] [Patrol] Hedefe gidilemedi (${err.message}). Yeni hedef seçiliyor...`);
            
            // Pathfinder'ı durdur ki takılı kalmasın
            this.bot.pathfinder.stop();
            
            // Hata durumunda çok hızlı döngüye girmemesi için az bekle
            await sleep(2000);
        }
    }
}

// --- MESAFE KONTROL VE RESET ---
function checkDistanceAndRestartPatrol(savedState) {
    // 'this' BotInstance'ı referans alır
    if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);

    if (!this.bot || !this.bot.entity) {
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartPatrol.call(this, savedState), 5000);
        return;
    }

    if (!this.patrolState) {
        return;
    }

    const bounds = savedState.bounds;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const botPos = this.bot.entity.position;
    
    const dx = botPos.x - centerX;
    const dz = botPos.z - centerZ;
    const distance = Math.sqrt(dx*dx + dz*dz);

    // console.log(`[${this.config.username}] [Patrol Kontrol] Merkeze mesafe: ${distance.toFixed(1)}`);

    if (distance > 200) {
        console.log(`[${this.config.username}] [Patrol] Alanın çok uzağındayım. Bekleniyor...`);
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartPatrol.call(this, savedState), 10000);
    } else {
        // Eğer bot boşta görünüyorsa ve patrolState varsa, görevi tekrar tetikle
        if (!this.isPatrolling) {
            console.log(`[${this.config.username}] [Patrol] Bot alana geri dönmüş/bağlanmış. Devriye tekrar başlatılıyor.`);
            startPatrol.call(this, bounds);
        } else {
            // Zaten çalışıyorsa sadece kontrol etmeye devam et
            this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartPatrol.call(this, savedState), 10000);
        }
    }
}

module.exports = { startPatrol, checkDistanceAndRestartPatrol };
