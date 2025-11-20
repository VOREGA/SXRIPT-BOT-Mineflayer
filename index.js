const express = require('express');
const fs = require('fs');
const vec3 = require('vec3');
const BotInstance = require('./BotInstance');
const path = require('path');



// --- 1. CONFIG VE BOTU YÜKLE ---
let config;
try {
    config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
} catch (e) {
    console.error('config.json okunamadı veya hatalı!', e);
    process.exit(1);
}

const stateFilePath = config.stateFileName;

if (fs.existsSync(stateFilePath)) {
    console.log(`[Sistem] Yeni oturum başlatıldı. Önceki görev dosyası temizleniyor...`);
    try {
        fs.unlinkSync(stateFilePath); 
    } catch (err) {
        console.error("Dosya silinirken hata (önemsiz):", err.message);
    }
}

const app = express();
let botInstance = null;

try {
    botInstance = new BotInstance(config);
    botInstance.start();
} catch (e) {
    console.error("Bot başlatılırken kritik bir hata oluştu:", e);
    process.exit(1);
}

// --- 2. WEB ARAYÜZÜ (HTML) ---
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// --- 3. WEB API ROTALARI ---
app.get('/api/status', (req, res) => {
    if (!botInstance) {
        return res.status(503).json({ status: 'Başlatılıyor', message: 'Bot henüz yüklenmedi.' });
    }
    res.json(botInstance.getStatus());
});


// ... (başlangıçtaki importlar aynı kalsın)

// --- SCHEMATIC API ---
// BU KISMI DEĞİŞTİRİYORUZ:
const schemDir = path.join(__dirname, 'fonksiyonlar', 'schematics'); // <-- Burası değişti
if (!fs.existsSync(schemDir)) fs.mkdirSync(schemDir, { recursive: true });

app.get('/api/schematics/list', (req, res) => {
    try {
        // .schem ve .schematic dosyalarını listele
        const files = fs.readdirSync(schemDir).filter(f => f.endsWith('.schematic') || f.endsWith('.schem'));
        res.json(files);
    } catch (e) { res.json([]); }
});

app.get('/api/schematics/analyze', async (req, res) => {
    if (!botInstance || !botInstance.builder) return res.status(404).send('Builder yok.');
    try {
        // Artık builder içinde yeni analyze fonksiyonu detaylı veri dönüyor
        const result = await botInstance.builder.analyzeSchematic(req.query.fileName);
        res.json(result);
    } catch (e) { res.status(500).send(e.message); }
});

// Start route'unda değişiklik yok ama hata mesajlarını görmek için hata yakalamayı emin olalım
app.get('/api/schematics/start', (req, res) => {
    if (!botInstance || !botInstance.builder) return res.status(404).send('Builder yok.');
    const { fileName, chestX, chestY, chestZ, minX, minZ, maxX, maxZ } = req.query;
    
    const chestCoords = { x: parseInt(chestX), y: parseInt(chestY), z: parseInt(chestZ) };
    const area = {
        minX: Math.min(parseInt(minX), parseInt(maxX)),
        maxX: Math.max(parseInt(minX), parseInt(maxX)),
        minZ: Math.min(parseInt(minZ), parseInt(maxZ)),
        maxZ: Math.max(parseInt(minZ), parseInt(maxZ))
    };

    botInstance.builder.start({ fileName, chestCoords, area })
        .then(() => res.send("İnşaat başlatıldı."))
        .catch(e => res.status(400).send("BAŞLATILAMADI: " + e.message)); // Hata mesajını net gönder
});

// ... (diğer rotalar aynı)

// --- HAREKET VE JOYSTICK API (YENİ) ---

// Tekil Hareket (Bir adım at)
app.get('/api/control/move', async (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    const { dir, time } = req.query;
    
    const duration = time ? parseInt(time) : 250; // Varsayılan çeyrek saniye
    const direction = dir || 'forward';

    try {
        await botInstance.moveTimed(direction, duration);
        res.status(200).send('Hareket edildi.');
    } catch (e) {
        res.status(500).send(e.message);
    }
});



// ... (/api/control/move rotasının altı)

// Tıklama İşlemi (Sol/Sağ Tık)
app.get('/api/control/click', async (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    
    const { type } = req.query; // 'left' veya 'right'
    if (type !== 'left' && type !== 'right') return res.status(400).send('Geçersiz tık.');

    try {
        const msg = await botInstance.performClick(type);
        res.status(200).send(msg);
    } catch (e) {
        // Hata olsa bile (örneğin kazarken) sunucuyu durdurmasın
        res.status(200).send('İşlem denendi.'); 
    }
});



// Joystick Bakış Güncellemesi
app.get('/api/control/look', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    
    const yaw = parseFloat(req.query.yaw);
    const pitch = parseFloat(req.query.pitch);

    if (!isNaN(yaw) && !isNaN(pitch)) {
        botInstance.lookUpdate(yaw, pitch);
        res.status(200).send('OK');
    } else {
        res.status(400).send('Geçersiz veri');
    }
});

// --- EXCAVATOR (KAZI) ---
app.get('/api/excavate', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    if (!botInstance.config.features.excavator) {
        return res.status(403).send('Kazı özelliği config dosyasında kapatılmış.');
    }
    
    const { x1, y1, z1, x2, y2, z2 } = req.query;
    const pos1 = vec3(parseInt(x1), parseInt(y1), parseInt(z1));
    const pos2 = vec3(parseInt(x2), parseInt(y2), parseInt(z2));
    if (isNaN(pos1.x) || isNaN(pos2.x)) return res.status(400).send('Koordinatlar geçersiz.');

    const bounds = {
        min: vec3(Math.min(pos1.x, pos2.x), Math.min(pos1.y, pos2.y), Math.min(pos1.z, pos2.z)),
        max: vec3(Math.max(pos1.x, pos2.x), Math.max(pos1.y, pos2.y), Math.max(pos1.z, pos2.z))
    };

    try {
        botInstance.startExcavateTask(bounds); 
        res.status(200).send(`Kazı görevi alındı (Max Y: ${bounds.max.y}). Alan taranıyor...`);
    } catch (e) {
        res.status(409).send(e.message);
    }
});

app.get('/api/stop-excavate', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    try {
        const message = botInstance.stopExcavateTask();
        res.status(200).send(message);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- YENİ: 3'LÜ FARMER SİSTEMİ ---

// 1. FENCE (ÇİTLİ)
app.get('/api/fence-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startFenceCactus(layers)
        .then(() => res.status(200).send(`${layers} katlı ÇİTLİ kaktüs görevi başlatıldı.`))
        .catch(e => res.status(409).send(e.message));
});

app.get('/api/stop-fence-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    res.send(botInstance.stopCactusTask()); 
});

// 2. İPLİ (NORMAL)
app.get('/api/ipli-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startIpliCactus(layers)
        .then(() => res.status(200).send(`${layers} katlı İPLİ kaktüs görevi başlatıldı.`))
        .catch(e => res.status(409).send(e.message));
});

app.get('/api/stop-ipli-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    res.send(botInstance.stopCactusTask());
});

// 3. TERS İPLİ
app.get('/api/ipli-ters-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startTersCactus(layers)
        .then(() => res.status(200).send(`${layers} katlı TERS İPLİ kaktüs görevi başlatıldı.`))
        .catch(e => res.status(409).send(e.message));
});

// --- DİĞER GENEL FONKSİYONLAR ---

app.get('/api/goto', async (req, res) => {
    const { x, y, z } = req.query;
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');

    const pos = vec3(parseInt(x), parseInt(y), parseInt(z));
    if (isNaN(pos.x) || isNaN(pos.y) || isNaN(pos.z)) {
        return res.status(400).send('Koordinatlar geçersiz.');
    }

    try {
        await botInstance.goTo(pos); 
        res.status(200).send(`${pos} konumuna gidildi.`);
    } catch (e) {
        res.status(409).send(e.message);
    }
});

app.get('/api/toss', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const categories = req.query.categories ? req.query.categories.split(',') : [];
    
    if (categories.length === 0) return res.status(400).send('Boşaltılacak kategori seçilmedi.');

    botInstance.tossInventory(categories)
        .then(() => res.send('Envanter boşaltma işlemi başlatıldı.'))
        .catch(e => res.status(409).send(e.message));
});

app.get('/api/follow', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { username } = req.query;
    if (!username) return res.status(400).send('Oyuncu adı belirtilmedi.');
    
    try {
        botInstance.startFollow(username);
        res.send(`${username} takip ediliyor...`);
    } catch (e) {
        res.status(409).send(e.message);
    }
});

app.get('/api/stop-follow', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    try {
        const message = botInstance.stopFollow();
        res.send(message);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/test-kick', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    try {
        const message = botInstance.testKick();
        res.status(200).send(message);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

app.get('/api/log-test', async (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    
    const itemName = req.query.item || 'cactus';
    const refOffset = [0, -1, 2];
    const faceVector = [0, 1, 0];
    
    if (!botInstance.logPlaceCoords) {
        return res.status(500).send('logPlaceCoords fonksiyonu BotInstance\'da tanımlı değil (Farmer.js export kontrolü yapın).');
    }

    try {
        await botInstance.logPlaceCoords(itemName, refOffset, faceVector, 'Yüzey Testi');
        res.status(200).send(`Test logu konsola yazıldı. Vec3 ve Yüzey bilgisini kontrol edin.`);
    } catch (e) {
        res.status(500).send(e.message);
    }
});

// --- PATROL (ALANI TURLA) ---
app.get('/api/patrol', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    if (botInstance.isBusy()) return res.status(409).send('Bot meşgul.');

    const { x1, z1, x2, z2 } = req.query;
    const minX = Math.min(parseInt(x1), parseInt(x2));
    const maxX = Math.max(parseInt(x1), parseInt(x2));
    const minZ = Math.min(parseInt(z1), parseInt(z2));
    const maxZ = Math.max(parseInt(z1), parseInt(z2));

    if (isNaN(minX) || isNaN(maxZ)) return res.status(400).send('Koordinatlar geçersiz.');

    botInstance.startPatrol({ minX, maxX, minZ, maxZ })
        .catch(e => console.error("Patrol hatası:", e));

    res.send('Devriye görevi başlatıldı.');
});

app.get('/api/stop-patrol', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    res.send(botInstance.stopPatrolTask());
});

// --- MODERATOR ESCAPE ---
app.get('/api/mod-list', (req, res) => {
    if (!botInstance) return res.json([]);
    res.json(botInstance.getModerators());
});

app.get('/api/mod-add', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    const { username } = req.query;
    if (username) botInstance.addModerator(username);
    res.json(botInstance.getModerators());
});

app.get('/api/mod-remove', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    const { username } = req.query;
    if (username) botInstance.removeModerator(username);
    res.json(botInstance.getModerators());
});

// --- WHITELIST ROTALARI ---
app.get('/api/whitelist-list', (req, res) => {
    if (!botInstance) return res.json([]);
    res.json(botInstance.getWhitelist());
});

app.get('/api/whitelist-add', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    const { username } = req.query;
    if (username) botInstance.addWhitelist(username);
    res.json(botInstance.getWhitelist());
});

app.get('/api/whitelist-remove', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    const { username } = req.query;
    if (username) botInstance.removeWhitelist(username);
    res.json(botInstance.getWhitelist());
});

// --- PARANOID MOD (HERKESDEN KAÇ) API ---
app.get('/api/toggle-paranoid', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    
    const { active } = req.query; 
    const newState = botInstance.toggleParanoidMode(active);
    
    res.send(newState ? "Paranoid Mod AÇILDI" : "Paranoid Mod KAPATILDI");
});

// --- YENİ: ENVANTER SLOT İŞLEMLERİ API ---
app.get('/api/inv-action', async (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    
    const { slot, action } = req.query;
    
    try {
        const msg = await botInstance.inventoryAction(slot, action);
        res.status(200).send(msg);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

// ... (/api/control/click rotasının altı)

// Hotbar Yuvasını Seçme (Hızlı Erişim 1-9)
app.get('/api/control/select', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot yok.');
    
    // index 0-8 arası hotbar yuvası. 1'den 9'a basınca 0'dan 8'e çevriliyor.
    const { index } = req.query; 

    try {
        const msg = botInstance.selectHotbarSlot(index);
        res.status(200).send(msg);
    } catch (e) {
        res.status(400).send(e.message);
    }
});

app.get('/api/inv-equip', async (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { slot } = req.query;

    try {
        const msg = await botInstance.equipItemFromSlot(slot);
        res.status(200).send(msg);
    } catch (e) {
        res.status(400).send(e.message);
    }
});


// --- SOHBET (CHAT) API ---
app.get('/api/chat', (req, res) => {
    // Botun varlığını ve sunucuya bağlı olup olmadığını kontrol et
    if (!botInstance || !botInstance.bot) {
        return res.status(404).send('Bot henüz sunucuya bağlı değil.');
    }
    
    const { message } = req.query;
    
    if (!message) {
        return res.status(400).send('Mesaj içeriği boş olamaz.');
    }

    try {
        // Bot üzerinden mesajı gönder
        botInstance.bot.chat(message);
        res.status(200).send(`Mesaj gönderildi: ${message}`);
    } catch (e) {
        res.status(500).send("Mesaj gönderilirken hata oluştu: " + e.message);
    }
});



app.get('/api/schematics/stop', (req, res) => {
    // Botun ve Mimarın (builder) varlığını kontrol et
    if (!botInstance || !botInstance.builder) {
        return res.status(404).send('Builder (Mimar) modülü bulunamadı.');
    }
    
    try {
        // İnşaatı durdur
        botInstance.builder.stop();
        res.send("İnşaat durduruldu ve hafıza temizlendi.");
    } catch (e) {
        res.status(500).send("Durdururken hata oluştu: " + e.message);
    }
});


app.get('/api/hizli-fence-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startHizliFenceCactus(layers)
        .then(() => res.status(200).send(`⚡ HIZLI MOD: ${layers} katlı ÇİTLİ kaktüs başladı!`))
        .catch(e => res.status(409).send(e.message));
});

// 2. HIZLI İPLİ
app.get('/api/hizli-ipli-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startHizliIpliCactus(layers)
        .then(() => res.status(200).send(`⚡ HIZLI MOD: ${layers} katlı İPLİ kaktüs başladı!`))
        .catch(e => res.status(409).send(e.message));
});

// 3. HIZLI TERS İPLİ
app.get('/api/hizli-ipli-ters-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    const { amount } = req.query;
    const layers = parseInt(amount);
    if (isNaN(layers) || layers <= 0) return res.status(400).send('Kat adedi geçersiz.');

    botInstance.startHizliTersCactus(layers)
        .then(() => res.status(200).send(`⚡ HIZLI MOD: ${layers} katlı TERS İPLİ kaktüs başladı!`))
        .catch(e => res.status(409).send(e.message));
});

// index.js dosyasında "3. TERS İPLİ" bölümünün altına bunu yapıştır:

app.get('/api/stop-ipli-ters-cactus', (req, res) => {
    if (!botInstance) return res.status(404).send('Bot bulunamadı.');
    // stopCactusTask genel bir durdurucudur, hangisi çalışıyorsa onu durdurur.
    res.send(botInstance.stopCactusTask()); 
});


// Frontend'in iframe portlarını öğrenmesi için API
app.get('/api/ports', (req, res) => {
    res.json({
        viewer: config.viewerPort || 3007,
        inventory: config.inventoryPort || 3008
    });
});

// --- 4. SUNUCUYU BAŞLAT ---
app.listen(config.webPort, () => {
    console.log(`[Web] Kontrol Paneli http://localhost:${config.webPort} adresinde başlatıldı.`);
    console.log('Bot yükleniyor...');
});