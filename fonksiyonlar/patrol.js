const { goals } = require('mineflayer-pathfinder');
const { GoalNear } = goals;
const vec3 = require('vec3');

// Rastgele bekleme
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startPatrol(bounds) {
    // 'this' BotInstance'ı referans alır
    
    // 1. Önce durumu kaydet (Kick yerse hatırlasın diye)
    // Eğer zaten bir state'den geliyorsak (restart) tekrar kaydetmeye gerek yok ama zararı da olmaz.
    if (!this.patrolState) {
        this.patrolState = {
            task: 'patrol',
            bounds: bounds
        };
        this.saveState(); // State.js üzerinden kaydet
    }

    console.log(`[${this.config.username}] [Patrol] Devriye görevi aktif. Alan: X[${bounds.minX}~${bounds.maxX}] Z[${bounds.minZ}~${bounds.maxZ}]`);
    this.isPatrolling = true;

    while (this.isPatrolling) {
        if (!this.bot || !this.bot.entity) break;

        // Hedef belirle
        const randomX = Math.floor(Math.random() * (bounds.maxX - bounds.minX + 1)) + bounds.minX;
        const randomZ = Math.floor(Math.random() * (bounds.maxZ - bounds.minZ + 1)) + bounds.minZ;
        const currentY = this.bot.entity.position.y;
        
        console.log(`[${this.config.username}] [Patrol] Hedefe gidiliyor: X:${randomX} Z:${randomZ}`);

        try {
            await this.bot.pathfinder.goto(new GoalNear(randomX, currentY, randomZ, 1));
            
            // Hedefe varınca bekle ve zıpla
            console.log(`[${this.config.username}] [Patrol] Hedefe ulaşıldı.`);
            
            if (Math.random() > 0.5) {
                this.bot.setControlState('jump', true);
                await sleep(300);
                this.bot.setControlState('jump', false);
            }
            
            const waitTime = Math.floor(Math.random() * 3000) + 2000;
            await sleep(waitTime);

        } catch (err) {
            console.warn(`[${this.config.username}] [Patrol] Yol hatası, yeni hedef seçiliyor...`);
            await sleep(2000);
        }
    }
}

// --- YENİ: MESAFE KONTROL VE RESET ---
function checkDistanceAndRestartPatrol(savedState) {
    // 'this' BotInstance'ı referans alır
    if (this.resumeCheckTimer) clearTimeout(this.resumeCheckTimer);

    if (!this.bot || !this.bot.entity) {
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartPatrol.call(this, savedState), 5000);
        return;
    }

    // Eğer kullanıcı arayüzden durdurduysa iptal et
    if (!this.patrolState) {
        console.log(`[${this.config.username}] [Patrol] Görev iptal edilmiş, kontrol durduruluyor.`);
        return;
    }

    const bounds = savedState.bounds;
    // Alanın merkezini bul
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const botPos = this.bot.entity.position;
    
    // Basit Öklid mesafesi (Y'yi ihmal ediyoruz, sadece yatay mesafe)
    const dx = botPos.x - centerX;
    const dz = botPos.z - centerZ;
    const distance = Math.sqrt(dx*dx + dz*dz);

    console.log(`[${this.config.username}] [Patrol Kontrol] Merkeze mesafe: ${distance.toFixed(1)} blok.`);

    if (distance > 200) {
        console.log(`[${this.config.username}] [Patrol Kontrol] Alanın çok uzağındayım (>200 blok). Beklemedeyim...`);
        // 10 saniye sonra tekrar kontrol et
        this.resumeCheckTimer = setTimeout(() => checkDistanceAndRestartPatrol.call(this, savedState), 10000);
    } else {
        console.log(`[${this.config.username}] [Patrol Kontrol] Alana yakınım/içindeyim. Devriye başlıyor!`);
        this.isPatrolling = true;
        startPatrol.call(this, bounds); // Döngüyü başlat
    }
}

module.exports = { startPatrol, checkDistanceAndRestartPatrol };