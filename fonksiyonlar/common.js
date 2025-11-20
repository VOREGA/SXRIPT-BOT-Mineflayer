const delay = require('util').promisify(setTimeout);
const { GoalNear } = require('mineflayer-pathfinder').goals;

// --- YARDIMCI VE GECİKME ---
async function randDelay(min, max) {
    const jitter = Math.random() * (max - min);
    await delay(min + jitter);
}

const MAX_RETRIES = 5;
const RETRY_DELAY = 2000;

async function retryAction(action, actionName = 'Eylem') {
    // Not: Bu fonksiyonun 'this' bağlamında (BotInstance) çalışması gerekir
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            while (this.isPausedForEating) {
                console.log(`[${this.config.username}] [Pause] '${actionName}' yemek molası için bekliyor...`);
                await delay(1000);
            }
            await action();
            return;
        } catch (error) {
            if (!this.bot) throw new Error("Bot bağlantısı kesildi.");
            if (error.message.includes('Görev durduruldu')) {
                 throw error;
            }
            console.warn(`[${this.config.username}] [Retry] '${actionName}' denemesi ${attempt}/${MAX_RETRIES} başarısız: ${error.message}`);
            if (error.name === 'path_interrupted' || error.name === 'path_stopped') {
                console.log(`[${this.config.username}] [Retry] Yol bulma takıldı, 1 saniye beklenip tekrar denenecek...`);
                await delay(1000);
            }
            else if (attempt === MAX_RETRIES) {
                console.error(`[${this.config.username}] [Retry] '${actionName}' ${MAX_RETRIES} denemeden sonra kalıcı olarak başarısız oldu.`);
                throw error;
            } else {
                await randDelay(RETRY_DELAY, RETRY_DELAY + 500);
            }
        }
    }
}

// --- YEMEK YEME ---
async function checkAndEat(isTaskPaused = false) {
    // 'this' BotInstance'ı referans alır
    if (!this.bot || !this.bot.food || !this.mcData) return;

    // Kilit: Zaten yemek yiyorsa (bot.isEating) veya yemeye çalışıyorsa (isPausedForEating) tekrar deneme.
    if (this.bot.food <= this.currentHungerTrigger && !this.bot.isEating && !this.isPausedForEating) {
        
        // Kilidi HEMEN al. İster görevde olsun ister boşta.
        this.isPausedForEating = true; 
        
        if(isTaskPaused) {
            console.log(`[${this.config.username}] [Yemek] (Görev) Duraklatılıyor... (Açlık: ${this.bot.food})`);
        } else {
             console.log(`[${this.config.username}] [Yemek] (Boşta) Acıktım (Açlık: ${this.bot.food})...`);
        }
        
        try {
            const food = this.bot.inventory.items().find(item => this.mcData.foodsByName[item.name]);
            if (food) {
                console.log(`[${this.config.username}] [Yemek] ${food.name} yeniliyor...`);
                await this.bot.equip(food, 'hand');
                await this.bot.consume(); 
                
                console.log(`[${this.config.username}] [Yemek] ${food.name} yendi. (Yeni Açlık: ${this.bot.food})`);
                if (this.bot.food > 19) {
                    this.currentHungerTrigger = Math.floor(Math.random() * 3) + 17;
                    console.log(`[${this.config.username}] [Yemek] Yeni açlık tetikleyicisi: ${this.currentHungerTrigger} olarak ayarlandı.`);
                }
            } else {
                console.warn(`[${this.config.username}] [Yemek] Yiyecek yok! (Görev duraklatıldı: ${isTaskPaused})`);
                if(isTaskPaused) await delay(2000); // Görevdeyse ve yemek yoksa bekle
            }
        } catch (err) {
            if (!err.message.includes('Consuming cancelled')) {
                 console.error(`[${this.config.username}] [Yemek] Yemek yeme hatası: ${err.message}`);
            }
        } finally {
            this.isPausedForEating = false; 
            
            if(isTaskPaused) {
                console.log(`[${this.config.username}] [Yemek] Görev devam ediyor.`);
            }
        }
    }
}

// --- ZIRH GİYME ---
const ARMOR_TIERS = ['leather', 'gold', 'chainmail', 'iron', 'diamond', 'netherite'];
const ARMOR_SLOTS_MAP = { 'head': ['_helmet'], 'torso': ['_chestplate'], 'legs': ['_leggings'], 'feet': ['_boots'] };
function getArmorTier(item) { if (!item) return 0; const name = item.name; for (let i = ARMOR_TIERS.length - 1; i >= 0; i--) { if (name.includes(ARMOR_TIERS[i])) { return i + 1; } } return 0; }
function getSlotId(slotName) { switch (slotName) { case 'head': return 5; case 'torso': return 6; case 'legs': return 7; case 'feet': return 8; default: return -1; } }

async function checkAndEquipBestArmor() {
    // 'this' BotInstance'ı referans alır
    if (!this.bot || !this.bot.inventory) return;
    const inventoryItems = this.bot.inventory.items();
    for (const slotName of Object.keys(ARMOR_SLOTS_MAP)) {
        let bestItemInInventory = null;
        let bestTier = 0;
        const slotSuffixes = ARMOR_SLOTS_MAP[slotName];
        for (const item of inventoryItems) {
            const isArmorForSlot = slotSuffixes.some(suffix => item.name.endsWith(suffix));
            if (isArmorForSlot) { const itemTier = getArmorTier(item); if (itemTier > bestTier) { bestTier = itemTier; bestItemInInventory = item; } }
        }
        const equippedItem = this.bot.inventory.slots[getSlotId(slotName)];
        const equippedTier = getArmorTier(equippedItem);
        if (bestItemInInventory && bestTier > equippedTier) {
            try {
                await randDelay(400, 600);
                await this.retryAction(() => this.bot.equip(bestItemInInventory, slotName), `Zırh giyme: ${bestItemInInventory.name}`);
                console.log(`[${this.config.username}] [Zırh] Daha iyi zırh bulundu ve giyildi: ${bestItemInInventory.name}`);
            } catch (err) { console.error(`[${this.config.username}] [Zırh] ${bestItemInInventory.name} giyilirken kalıcı hata:`, err.message); }
        }
    }
}

// --- ENVANTER BOŞALTMA (TOSS) ---
// Kategori belirleme yardımcıları
function isFood(item, mcData) {
    return mcData.foodsByName[item.name];
}
function isArmor(item) {
    const name = item.name;
    return name.endsWith('_helmet') || name.endsWith('_chestplate') || name.endsWith('_leggings') || name.endsWith('_boots');
}
function isTool(item) {
    const name = item.name;
    return name.endsWith('_sword') || name.endsWith('_pickaxe') || name.endsWith('_axe') || name.endsWith('_shovel') || name.endsWith('_hoe') || name === 'flint_and_steel' || name === 'shears' || name === 'fishing_rod';
}
function isBlock(item, mcData) {
    return mcData.blocksByName[item.name];
}
async function tossInventoryItems(categories) {
    // 'this' BotInstance'ı referans alır
    if (!this.bot || !this.mcData) throw new Error("Bot bağlı değil veya mcData yüklenemedi.");
    
    console.log(`[${this.config.username}] [Toss] Envanter taranıyor. Kategoriler: ${categories.join(', ')}`);
    
    const itemsToToss = [];
    const inventory = this.bot.inventory.items();

    for (const item of inventory) {
        if (categories.includes('food') && isFood(item, this.mcData)) {
            itemsToToss.push(item);
        } else if (categories.includes('armor') && isArmor(item)) {
            itemsToToss.push(item);
        } else if (categories.includes('tools') && isTool(item)) {
            itemsToToss.push(item);
        } else if (categories.includes('blocks') && isBlock(item, this.mcData)) {
            itemsToToss.push(item);
        } else if (categories.includes('other')) {
            if (!isFood(item, this.mcData) && !isArmor(item) && !isTool(item) && !isBlock(item, this.mcData)) {
                itemsToToss.push(item);
            }
        }
    }
    if (itemsToToss.length === 0) {
        console.log(`[${this.config.username}] [Toss] Seçilen kategorilerde atılacak item bulunamadı.`);
        return;
    }
    console.log(`[${this.config.username}] [Toss] ${itemsToToss.length} farklı item türü atılıyor...`);
    
    for (const item of itemsToToss) {
        if (!this.isTossing) { // Eğer 'stop' komutu gelirse
            throw new Error("Toss işlemi kullanıcı tarafından durduruldu.");
        }
        try {
            console.log(`[${this.config.username}] [Toss] ${item.name} (x${item.count}) atılıyor...`);
            await this.bot.tossStack(item);
            await this.randDelay(100, 200); // Sunucuyu yormamak için küçük gecikme
        } catch (e) {
            console.warn(`[${this.config.username}] [Toss] ${item.name} atılırken hata: ${e.message}`);
        }
    }
}

// --- GOTO (API İÇİN) ---
// Not: 'isBusy' kontrolü artık BotInstance.js içinde yapılıyor.
async function goTo(pos) {
    if (!this.bot || !this.bot.entity) throw new Error('Bot henüz oyuna girmedi.');
    
    console.log(`[${this.config.username}] [API] /goto komutu alındı. Hedef: ${pos}`);
    try {
        await this.randDelay(500, 600); 
        await this.bot.pathfinder.goto(new GoalNear(pos.x, pos.y, pos.z, 1)); 
        console.log(`[${this.config.username}] [API] /goto hedefine ulaşıldı: ${pos}`);
    } catch (err) {
        console.error(`[${this.config.username}] [API] /goto hatası: ${err.message}`);
        throw err;
    }
}

module.exports = {
    randDelay,
    retryAction,
    checkAndEat,
    checkAndEquipBestArmor,
    tossInventoryItems, // <-- YENİ
    goTo
};