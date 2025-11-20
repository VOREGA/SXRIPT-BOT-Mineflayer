<div align="center">

# 🤖 SXRIPT BOT
### Advanced Mineflayer Automation & Web Interface

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![Version](https://img.shields.io/badge/version-1.0.0-orange.svg)

[🇺🇸 **English**](#-english) | [🇹🇷 **Türkçe**](#-türkçe)

</div>

---

<a name="-english"></a>
## 🇺🇸 English

**SXRIPT BOT** is a modular, AI-supported **Mineflayer** bot managed via a modern Web Interface, designed for Minecraft servers (Survival, Skyblock, and Anarchy).

This is not just an ordinary AFK bot; it can **build structures using Schematics, excavate massive areas, construct automatic cactus farms with 3 different designs, and protect itself with security protocols.**

### 🚀 Features

* **🖥️ Advanced Web Panel:** Control the bot via a modern Web Interface (Mobile/Tablet compatible) instead of typing in-game commands.
* **👀 Live View (Prismarine Viewer):** Watch what the bot sees in real-time directly from your browser.
* **🎒 Inventory Management:** View, equip, drop, or organize the bot's inventory via the web.
* **⛏️ Excavator:** Excavates massive areas layer by layer within specified coordinates.
* **🌵 Advanced Cactus Architecture:**
    * **Normal Mode:** Human-like construction with Anti-Cheat protection.
    * **⚡ FAST MODE (Speedrun):** Removes delays to build at maximum speed (Riskier but faster).
    * **3 Build Types:** Fence, String, and Reverse String designs.
* **🏗️ Schematic Builder:** Builds structures automatically by reading `.schematic` files. Refills materials from chests if they run out.
* **🛡️ Security Protocols:**
    * **Moderator Detection:** Disconnects immediately if a staff member is spotted.
    * **Paranoid Mode:** Disconnects if *any player* (except Whitelisted ones) enters the render distance.
* **🕹️ FPS & Manual Control:** Control the bot like a player using WASD and Joystick on the web.

### 🛠️ Installation

**Node.js** is required to run this bot.

1.  **Download:** Clone this repository or download as ZIP.
2.  **Install Dependencies:** Double-click `install.bat` (or run `npm install` in terminal).
3.  **Configuration:**
    * Rename `config.ornek.json` to `config.json`.
    * Edit the file with your server details:
    ```json
    {
      "host": "play.serveraddress.com",
      "username": "BotName",
      "password": "YourPassword",
      "version": "1.16.5"
    }
    ```
4.  **Start:** Double-click `start.bat`. The Web Panel will open automatically.

### 🎮 Usage (Web Panel)

Once the bot starts, open your browser and go to:
**http://localhost:3000**

* **Bot Status:** Shows current action and connection status.
* **Manual Control:** WASD movement and camera control.
* **Task Manager:** Start Excavation, Cactus Farm, or Patrol tasks.
* **Architect:** Load schematics and start building.
* **Security:** Manage Whitelist and Paranoid mode.

---

### ⚠️ Disclaimer
This software is developed for **educational and testing purposes**. Most Minecraft servers prohibit the use of bots.
* Read the rules of the server you are using.
* The developer is **not responsible** for any bans, account closures, or penalties.
* Use at your own risk.

---

<br>

<a name="-türkçe"></a>
## 🇹🇷 Türkçe

**SXRIPT BOT**, Minecraft sunucularında (Survival, Skyblock ve Anarchy) gelişmiş otomasyon işlemleri yapabilen, Web Arayüzü üzerinden yönetilen, yapay zeka destekli modüler bir **Mineflayer** botudur.

Bu bot sıradan bir AFK botu değildir; **Schematic ile yapı inşa edebilir, devasa alanları kazabilir, 3 farklı yöntemle otomatik kaktüs farmı kurabilir ve güvenlik protokolleri ile kendini koruyabilir.**

### 🚀 Özellikler

* **🖥️ Gelişmiş Web Paneli:** Botu oyun içinden komut yazarak değil, modern bir Web Arayüzü üzerinden (Tablet/Telefon uyumlu) yönetin.
* **👀 Canlı İzleme (Prismarine Viewer):** Botun ne gördüğünü tarayıcınızdan canlı izleyin.
* **🎒 Envanter Yönetimi:** Botun envanterini web üzerinden görün, eşya atın, giyin veya düzenleyin.
* **⛏️ Excavator (Alan Kazıcı):** Belirlenen koordinatlar arasındaki devasa alanları katman katman kazar.
* **🌵 Gelişmiş Kaktüs Mimarisi:**
    * **Normal Mod:** Anti-Cheat korumalı, insan benzeri hareketlerle inşaat.
    * **⚡ HIZLI MOD (Speedrun):** Bekleme sürelerini kaldırarak maksimum hızda inşaat yapar.
    * **3 Farklı Yapı Tipi:** Çitli (Fence), İpli (String) ve Ters Örgü (Reverse) tasarımları.
* **🏗️ Schematic Builder (Mimar):** `.schematic` dosyalarını okuyarak otomatik yapılar inşa eder. Malzeme yetmezse sandıktan gidip alır.
* **🛡️ Güvenlik Protokolleri:**
    * **Moderatör Tespiti:** Yetkili görürse sunucudan kaçar.
    * **Paranoid Mod:** Whitelist (Güvenli Liste) haricinde *herhangi bir oyuncu* görürse anında oyundan çıkar.
* **🕹️ FPS & Manuel Kontrol:** Web üzerinden WASD ve Joystick ile botu karakter gibi yönetin.

### 🛠️ Kurulum

Botu çalıştırmak için bilgisayarınızda **Node.js** yüklü olmalıdır.

1.  **İndirme:** Bu projeyi bilgisayarınıza indirin (`Code` -> `Download ZIP`).
2.  **Yükleme:** Klasörün içindeki `install.bat` dosyasına çift tıklayın (veya terminale `npm install` yazın).
3.  **Ayarlar:**
    * `config.ornek.json` dosyasının adını `config.json` olarak değiştirin.
    * Dosyayı açıp sunucu bilgilerinizi girin:
    ```json
    {
      "host": "oyna.sunucuadresi.com",
      "username": "BotIsmi",
      "password": "Sifreniz",
      "version": "1.16.5"
    }
    ```
4.  **Başlatma:** `start.bat` dosyasına çift tıklayın.

### 🎮 Kullanım (Web Panel)

Bot başladığında tarayıcınızdan **http://localhost:3000** adresine gidin.

* **Bot Durumu:** Botun ne yaptığını takip edin.
* **Manuel Kontrol:** Botu oyuncu gibi hareket ettirin.
* **Görev Yöneticisi:** Kazı, Farm ve Devriye görevlerini başlatın.
* **Mimar:** Yapı dosyalarını yükleyip inşa ettirin.
* **Güvenlik:** Yasaklı listesi ve koruma modlarını ayarlayın.

---

### ⚠️ Yasal Uyarı
Bu yazılım **eğitim ve deneme amaçlı** geliştirilmiştir. Minecraft sunucularının çoğu bot kullanımını yasaklamaktadır.
* Oluşabilecek **banlanma (yasaklanma)** veya cezai durumlardan **geliştirici sorumlu değildir.**
* Kullanım riski tamamen kullanıcıya aittir.

---

### 👨‍💻 Developer / Geliştirici
This project is open source. / Bu proje açık kaynaklıdır.

**License:** MIT License
