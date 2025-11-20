const fs = require('fs');

function saveState() {
    // 'this' BotInstance'ı referans alır
    let state = null;

    // ÖNCELİK SIRASI:
    // 1. Mimar (Schematic Builder) - En karmaşık yapı olduğu için en başa koydum
    if (this.builder && this.builder.active) {
        state = this.builder.getState();
        state.type = 'schematic_build'; 
    } 
    // 2. Excavator (Kazı)
    else if (this.excavationState) {
        state = this.excavationState;
    } 
    // 3. Farmer (Çitli)
    else if (this.cactusState) { 
        state = this.cactusState;
        state.type = 'fence'; 
    } 
    // 4. Farmer (İpli)
    else if (this.ipliCactusState) { 
        state = this.ipliCactusState;
        state.type = 'ipli'; 
    } 
    // 5. Farmer (Ters İpli)
    else if (this.ipliTersCactusState) { 
        state = this.ipliTersCactusState;
        state.type = 'ipli_ters';
    }

    if (!state) {
        return;
    }
    
    console.log(`[${this.config.username}] [Durum] Görev (${state.task || 'Bilinmiyor'}, Tip: ${state.type}) kaydediliyor...`);
    fs.writeFileSync(this.config.stateFileName, JSON.stringify(state, null, 2));
}

function loadState() {
    const path = this.config.stateFileName;
    if (!fs.existsSync(path)) return null;
    try {
        const data = fs.readFileSync(path, 'utf8');
        const state = JSON.parse(data);
        return state;
    } catch (err) {
        console.error(`[${this.config.username}] [Durum] Görev durumu yüklenemedi:`, err);
        return null;
    }
}

function deleteState() {
    console.log(`[${this.config.username}] [Durum] Görev durumu siliniyor (tamamlandı/durduruldu).`);
    
    // Tüm state değişkenlerini sıfırla
    this.excavationState = null;
    this.cactusState = null;
    this.ipliCactusState = null;
    this.ipliTersCactusState = null;
    
    // Builder'ı durdur ama active flag'ini false yapmayı unutma (zaten stop() içinde yapılıyor olmalı)
    if(this.builder) {
        this.builder.active = false; 
    }

    const path = this.config.stateFileName;
    if (fs.existsSync(path)) {
        fs.unlinkSync(path);
    }
}

module.exports = {
    saveState,
    loadState,
    deleteState
};