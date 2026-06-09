import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, serverTimestamp, 
    query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyC4KTziZ6xDsB-2Lnovr1Fp9UC8hd1KWhE",
  authDomain: "fatih-baris-akademi.firebaseapp.com",
  projectId: "fatih-baris-akademi",
  storageBucket: "fatih-baris-akademi.firebasestorage.app",
  messagingSenderId: "36408364342",
  appId: "1:36408364342:web:e0988fae27e0f140117797"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

document.addEventListener("DOMContentLoaded", function () {
    let aktifFiyatlar = { teorik: "0", kapali: "0", yol: "0", tum: "0" };
    let sonSnapshotVerisi = null;
    let tumBasvurular = [];

    const whatsappNumarasiTemizle = (tel) => {
        if (!tel) return "";
        let temiz = String(tel).replace(/[^0-9]/g, ''); 
        if (temiz.startsWith('0')) {
            temiz = '90' + temiz.substring(1);
        }
        if (!temiz.startsWith('90') && temiz.length === 10) {
            temiz = '90' + temiz;
        }
        return temiz;
    };

    // --- Sayaç Animasyonu Kontrolü ---
    const sayacElementleri = document.querySelectorAll('.istatistik-kutu h3');
    if (sayacElementleri.length > 0) {
        const saymaSuresiMilisaniye = 1500;
        sayacElementleri.forEach(el => {
            if (!el.dataset.orjinal) el.dataset.orjinal = el.innerText;
        });

        const sayacBaslat = (element) => {
            if (element.dataset.animationId) cancelAnimationFrame(parseInt(element.dataset.animationId));
            const hamMetin = element.dataset.orjinal;
            const hedefSayi = parseInt(hamMetin.replace(/[^0-9]/g, ''));
            const metinEki = hamMetin.replace(/[0-9.]/g, ''); 
            if (isNaN(hedefSayi)) return;

            const baslangicZamani = performance.now();
            const animasyonAdimi = (suankiZaman) => {
                const gecenSure = suankiZaman - baslangicZamani;
                let ilerleme = Math.min(gecenSure / saymaSuresiMilisaniye, 1);
                const easeOut = 1 - Math.pow(1 - ilerleme, 2); 
                element.innerText = Math.floor(easeOut * hedefSayi).toLocaleString('tr-TR') + metinEki;
                if (ilerleme < 1) {
                    element.dataset.animationId = requestAnimationFrame(animasyonAdimi);
                }
            };
            element.dataset.animationId = requestAnimationFrame(animasyonAdimi);
        };

        const gozlemci = new IntersectionObserver((girdiler) => {
            girdiler.forEach(girdi => {
                if (girdi.isIntersecting) sayacBaslat(girdi.target);
                else {
                    const metinEki = girdi.target.dataset.orjinal.replace(/[0-9.]/g, '');
                    girdi.target.innerText = "0" + metinEki;
                    if (girdi.target.dataset.animationId) cancelAnimationFrame(parseInt(girdi.target.dataset.animationId));
                }
            });
        }, { threshold: 0.1 });
        sayacElementleri.forEach(sayac => gozlemci.observe(sayac));
    }

    // --- Kayıt Formu Yönetimi ---
    const kayitFormu = document.querySelector('form[action="onay.html"]');
    if (kayitFormu) {
        kayitFormu.addEventListener('submit', async function(e) {
            e.preventDefault();
            const submitButon = kayitFormu.querySelector('button');
            const orjinalButonMetni = submitButon.innerText;
            submitButon.innerText = "İşleniyor...";
            submitButon.disabled = true;

            const seciliPaketler = Array.from(document.querySelectorAll('input[name="paketler"]:checked')).map(p => p.value);

            try {
                await addDoc(collection(db, "basvurular"), {
                    ad: document.getElementById('ad').value,
                    soyad: document.getElementById('soyad').value,
                    yas: document.getElementById('yas').value,
                    telefon: document.getElementById('telefon').value,
                    meslek: document.getElementById('meslek').value,
                    motosiklet: document.getElementById('motosiklet').value,
                    tecrube: document.getElementById('tecrube').value,
                    paketler: seciliPaketler,
                    neden: document.getElementById('neden').value,
                    durum: "beklemede",
                    kayitTarihi: serverTimestamp()
                });
                window.location.href = "onay.html";
            } catch (error) {
                console.error("Kayıt hatası:", error);
                alert("Başvuru alınırken bir hata oluştu.");
                submitButon.innerText = orjinalButonMetni;
                submitButon.disabled = false;
            }
        });
    }

    // --- Admin Giriş İşlemleri ---
    const loginForm = document.getElementById('admin-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const sifre = document.getElementById('login-password').value;
            const btn = loginForm.querySelector('button');
            
            btn.innerText = "Doğrulanıyor...";
            btn.disabled = true;

            try {
                await signInWithEmailAndPassword(auth, email, sifre);
                window.location.href = "admin-panel.html";
            } catch (error) {
                alert("Giriş Başarısız: Hatalı kullanıcı adı veya şifre girdiniz.");
                btn.innerText = "Giriş Yap";
                btn.disabled = false;
            }
        });
    }

    // --- Admin Oturum Kapatma ---
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "admin-login.html";
            });
        });
    }

    // --- Oturum Durumu Kontrolü ---
    onAuthStateChanged(auth, (user) => {
        const suankiSayfa = window.location.pathname;
        if (suankiSayfa.includes("admin-panel.html") && !user) {
            window.location.href = "admin-login.html";
        }
        if (suankiSayfa.includes("admin-login.html") && user) {
            window.location.href = "admin-panel.html";
        }
    });

    // --- Yönetim Paneli Dinamik Tablo ve Metrik Motoru ---
    const tabloGovdesi = document.getElementById('basvuru-tablo-govdesi');
    if (tabloGovdesi) {
        const aramaInput = document.getElementById('admin-arama-input');
        const durumFiltre = document.getElementById('admin-durum-filtre');
        const exportBtn = document.getElementById('admin-export-btn');

        const paketHaritasi = {
            "tum": "Güvenli ve İleri Sürüş Teknikleri (Tüm Paket)",
            "teorik": "Teorik Eğitim Paketi",
            "kapali": "Kapalı Alan Eğitim Paketi",
            "yol": "Yol Sürüş Eğitim Paketi"
        };

        const durumMetinHaritasi = {
            "beklemede": "Beklemede",
            "arandi": "Arandı",
            "kapora": "Kapora Alındı",
            "onaylandi": "Onaylandı",
            "tamamlandi": "Eğitim Tamamlandı",
            "iptal": "İptal Edildi",
            "arsiv": "Arşivlendi"
        };

        const rozetRenkleri = {
            "beklemede": { bg: "rgba(234, 179, 8, 0.1)", fg: "#eab308" },
            "arandi": { bg: "rgba(59, 130, 246, 0.1)", fg: "#3b82f6" },
            "kapora": { bg: "rgba(249, 115, 22, 0.1)", fg: "#f97316" },
            "onaylandi": { bg: "rgba(34, 197, 94, 0.1)", fg: "#22c55e" },
            "tamamlandi": { bg: "rgba(13, 148, 136, 0.1)", fg: "#0d9488" },
            "iptal": { bg: "rgba(239, 68, 68, 0.1)", fg: "#ef4444" },
            "arsiv": { bg: "rgba(148, 163, 184, 0.1)", fg: "#94a3b8" }
        };

        const listeleyiGuncelle = () => {
            if (tumBasvurular.length === 0) {
                tabloGovdesi.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Sistemde kayıtlı başvuru bulunmamaktadır.</td></tr>`;
                return;
            }

            const aramaKelimesi = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
            const secilenDurum = durumFiltre ? durumFiltre.value : "aktif";

            let htmlIcerik = "";
            let filtrelenmisAdet = 0;

            tumBasvurular.forEach((veri) => {
                const kKursiyerAd = String(veri.ad || "");
                const kKursiyerSoyad = String(veri.soyad || "");
                const adSoyad = (kKursiyerAd + " " + kKursiyerSoyad).toLowerCase();
                const telefon = veri.telefon ? String(veri.telefon).toLowerCase() : "";
                const sDurum = veri.durum || "beklemede";
                
                const aramaUyumlu = adSoyad.includes(aramaKelimesi) || telefon.includes(aramaKelimesi);
                
                let durumUyumlu = false;
                if (secilenDurum === "aktif") {
                    durumUyumlu = sDurum !== "arsiv";
                } else if (secilenDurum === "hepsi") {
                    durumUyumlu = true;
                } else {
                    durumUyumlu = sDurum === secilenDurum;
                }

                if (aramaUyumlu && durumUyumlu) {
                    filtrelenmisAdet++;
                    
                    const paketMetni = veri.paketler && Array.isArray(veri.paketler) && veri.paketler.length > 0 
                        ? veri.paketler.map(p => paketHaritasi[p] || p).join(", ") 
                        : "Seçim Yok";

                    const temizNumara = whatsappNumarasiTemizle(veri.telefon);
                    
                    let taslakMesaj = "";
                    if (veri.egitimBaslangicTarihi && veri.egitimBitisTarihi) {
                        const tBas = veri.egitimBaslangicTarihi.split("-").reverse().join(".");
                        const tBit = veri.egitimBitisTarihi.split("-").reverse().join(".");
                        taslakMesaj = encodeURIComponent(`Merhaba ${kKursiyerAd} ${kKursiyerSoyad},\n\nFatih Barış Akademi bünyesindeki direksiyon eğitiminiz ${tBas} - ${tBit} tarihleri arasında (bu tarihler dahil) planlanmıştır. Belirtilen günlerde eğitim alanında hazır bulunmanızı rica eder, güvenli sürüşler dileriz.`);
                    } else {
                        taslakMesaj = encodeURIComponent(`Merhaba ${kKursiyerAd} ${kKursiyerSoyad},\n\nFatih Barış Akademi web sitemiz üzerinden yapmış olduğunuz "Motosiklet Güvenli ve İleri Sürüş Teknikleri" ön başvurunuz tarafımıza ulaşmıştır. Eğitim sürecini planlamak ve detayları görüşmek adına müsait olduğunuz bir zaman dilimini iletebilir misiniz?\n\nİyi günler, güvenli sürüşler dileriz.`);
                    }
                    
                    const renk = rozetRenkleri[sDurum] || { bg: "rgba(234, 179, 8, 0.1)", fg: "#eab308" };
                    const durumGosterimMetni = durumMetinHaritasi[sDurum] || sDurum;

                    htmlIcerik += `
                        <tr>
                            <td>
                                <b>${kKursiyerAd} ${kKursiyerSoyad}</b><br>
                                <small style="color: #64748b;">Yaş: ${veri.yas || "-"} | ${veri.meslek || "-"}</small>
                                ${veri.egitimBaslangicTarihi ? `<br><span style="color: #3b82f6; font-size: 11px; font-weight: 600;"><i class="fa-solid fa-calendar-day"></i> P: ${veri.egitimBaslangicTarihi.split("-").reverse().join(".")} - ${veri.egitimBitisTarihi.split("-").reverse().join(".")}</span>` : ""}
                            </td>
                            <td>
                                <div style="display: flex; flex-direction: column; gap: 6px;">
                                    <a href="tel:${veri.telefon || ""}" style="color: #ff4500; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 6px;">
                                        <i class="fa-solid fa-phone"></i> ${veri.telefon || "-"}
                                    </a>
                                    <a href="https://wa.me/${temizNumara}?text=${taslakMesaj}" target="_blank" style="color: #22c55e; text-decoration: none; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; font-size: 13px;">
                                        <i class="fa-brands fa-whatsapp" style="font-size: 15px;"></i> WhatsApp ile Yaz
                                    </a>
                                </div>
                            </td>
                            <td>
                                <b>${veri.motosiklet || "-"}</b><br>
                                <small style="color: #64748b;">Tecrübe: ${veri.tecrube || "-"}</small>
                            </td>
                            <td><span style="color: #ffffff; font-size: 14px;">${paketMetni}</span></td>
                            <td>
                                <span class="status-badge" style="background: ${renk.bg}; color: ${renk.fg}; padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; display: inline-block; text-transform: capitalize;">
                                    ${durumGosterimMetni}
                                </span>
                            </td>
                            <td>
                                <select class="action-btn" onchange="durumDegistir('${veri.id}', this.value)" style="width: 130px;">
                                    <option value="beklemede" ${sDurum === 'beklemede' ? 'selected' : ''}>Beklemede</option>
                                    <option value="arandi" ${sDurum === 'arandi' ? 'selected' : ''}>Arandı</option>
                                    <option value="kapora" ${sDurum === 'kapora' ? 'selected' : ''}>Kapora Alındı</option>
                                    <option value="onaylandi" ${sDurum === 'onaylandi' ? 'selected' : ''}>Onaylandı</option>
                                    <option value="tamamlandi" ${sDurum === 'tamamlandi' ? 'selected' : ''}>Tamamlandı</option>
                                    <option value="iptal" ${sDurum === 'iptal' ? 'selected' : ''}>İptal Edildi</option>
                                    <option value="arsiv" ${sDurum === 'arsiv' ? 'selected' : ''}>Arşivle</option>
                                </select>
                                <button class="action-btn" onclick="detayGoster('${veri.id}')" style="color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); margin-left: 5px;">
                                    <i class="fa-solid fa-eye"></i>
                                </button>
                                <button class="action-btn" onclick="basvuruSil('${veri.id}')" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2); margin-left: 5px;">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                }
            });

            tabloGovdesi.innerHTML = filtrelenmisAdet === 0 
                ? `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Kriterlere uygun sonuç bulunamadı.</td></tr>` 
                : htmlIcerik;
        };

        const metrikleriHesaplaVeGuncelle = () => {
            if (!sonSnapshotVerisi) return;

            tumBasvurular = [];
            let countToplam = 0, countBeklemede = 0, countArandi = 0, countOnaylandi = 0;
            let dTum = 0, dTeorik = 0, dKapali = 0, dYol = 0, toplamCiro = 0;

            const fiyatTum = Number(String(aktifFiyatlar.tum).replace(/[^0-9]/g, '')) || 0;
            const fiyatTeorik = Number(String(aktifFiyatlar.teorik).replace(/[^0-9]/g, '')) || 0;
            const fiyatKapali = Number(String(aktifFiyatlar.kapali).replace(/[^0-9]/g, '')) || 0;
            const fiyatYol = Number(String(aktifFiyatlar.yol).replace(/[^0-9]/g, '')) || 0;

            sonSnapshotVerisi.forEach((docSnap) => {
                const veri = docSnap.data();
                tumBasvurular.push({ id: docSnap.id, ...veri });

                const sDurum = veri.durum || "beklemede";
                
                if (sDurum !== "arsiv") {
                    countToplam++;
                    if (sDurum === "beklemede") countBeklemede++;
                    else if (sDurum === "arandi") countArandi++;
                    else if (sDurum === "onaylandi" || sDurum === "kapora" || sDurum === "tamamlandi") countOnaylandi++;
                }

                if (veri.paketler && Array.isArray(veri.paketler)) {
                    veri.paketler.forEach(p => {
                        if (p === "tum") { dTum++; if (sDurum === "onaylandi" || sDurum === "kapora" || sDurum === "tamamlandi") toplamCiro += fiyatTum; }
                        else if (p === "teorik") { dTeorik++; if (sDurum === "onaylandi" || sDurum === "kapora" || sDurum === "tamamlandi") toplamCiro += fiyatTeorik; }
                        else if (p === "kapali") { dKapali++; if (sDurum === "onaylandi" || sDurum === "kapora" || sDurum === "tamamlandi") toplamCiro += fiyatKapali; }
                        else if (p === "yol") { dYol++; if (sDurum === "onaylandi" || sDurum === "kapora" || sDurum === "tamamlandi") toplamCiro += fiyatYol; }
                    });
                }
            });

            tumBasvurular.sort((a, b) => {
                const tA = a.kayitTarihi && a.kayitTarihi.seconds ? a.kayitTarihi.seconds : 0;
                const tB = b.kayitTarihi && b.kayitTarihi.seconds ? b.kayitTarihi.seconds : 0;
                return tB - tA;
            });

            document.getElementById('stat-toplam').innerText = countToplam;
            document.getElementById('stat-beklemede').innerText = countBeklemede;
            document.getElementById('stat-arandi').innerText = countArandi;
            document.getElementById('stat-onaylandi').innerText = countOnaylandi;
            document.getElementById('stat-ciro').innerText = toplamCiro.toLocaleString('tr-TR') + " TL";

            const elements = { 'dist-tum': dTum, 'dist-teorik': dTeorik, 'dist-kapali': dKapali, 'dist-yol': dYol };
            Object.keys(elements).forEach(id => {
                const el = document.getElementById(id);
                if (el) el.innerText = elements[id];
            });

            // --- Takvim Barı Arası Rendering Motoru ---
            const takvimListesiEl = document.getElementById('yaklasan-egitimler-listesi');
            if (takvimListesiEl) {
                const planliEgitimler = tumBasvurular.filter(b => b.egitimBaslangicTarihi && b.egitimBaslangicTarihi >= "2026-06-09" && b.durum !== "arsiv" && b.durum !== "iptal");
                
                planliEgitimler.sort((a, b) => a.egitimBaslangicTarihi.localeCompare(b.egitimBaslangicTarihi));

                if (planliEgitimler.length === 0) {
                    takvimListesiEl.innerHTML = `<div style="color: #64748b; font-size: 14px; grid-column: 1 / -1; padding: 5px;">Planlanmış aktif bir eğitim bulunmuyor.</div>`;
                } else {
                    let takvimHtml = "";
                    planliEgitimler.slice(0, 8).forEach(b => {
                        const tBasGoster = b.egitimBaslangicTarihi.split("-").reverse().join(".");
                        const tBitGoster = b.egitimBitisTarihi.split("-").reverse().join(".");
                        takvimHtml += `
                            <div style="background: #0f172a; border: 1px solid #334155; border-radius: 8px; padding: 12px; display: flex; flex-direction: column; gap: 6px;">
                                <b style="color: #ffffff; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${b.ad} ${b.soyad}</b>
                                <div style="color: #94a3b8; font-size: 12px; display: flex; align-items: center; gap: 5px; font-weight: 500;">
                                    <i class="fa-solid fa-calendar-days" style="color: #ff4500;"></i> ${tBasGoster} - ${tBitGoster}
                                </div>
                                <div style="color: #64748b; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    <i class="fa-solid fa-motorcycle"></i> ${b.motosiklet || "-"}
                                </div>
                            </div>
                        `;
                    });
                    takvimListesiEl.innerHTML = takvimHtml;
                }
            }

            listeleyiGuncelle();
        };

        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                if (tumBasvurular.length === 0) {
                    alert("Dışa aktarılacak herhangi bir başvuru kaydı bulunmamaktadır.");
                    return;
                }
                const aramaKelimesi = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
                const secilenDurum = durumFiltre ? durumFiltre.value : "aktif";

                let csvIcerik = "\uFEFFKursiyer Adı Soyadı;Telefon;Yaş;Meslek;Motosiklet;Tecrübe;Talep Edilen Eğitim;Durum;Başlangıç Tarihi;Bitiş Tarihi;Yönetici Notu\n";

                tumBasvurular.forEach((veri) => {
                    const kKursiyerAd = String(veri.ad || "");
                    const kKursiyerSoyad = String(veri.soyad || "");
                    const adSoyad = (kKursiyerAd + " " + kKursiyerSoyad).toLowerCase();
                    const telefon = veri.telefon ? String(veri.telefon).toLowerCase() : "";
                    const sDurum = veri.durum || "beklemede";
                    
                    let durumUyumlu = false;
                    if (secilenDurum === "aktif") durumUyumlu = sDurum !== "arsiv";
                    else if (secilenDurum === "hepsi") durumUyumlu = true;
                    else durumUyumlu = sDurum === secilenDurum;

                    if ((adSoyad.includes(aramaKelimesi) || telefon.includes(aramaKelimesi)) && durumUyumlu) {
                        const tamAd = `${kKursiyerAd} ${kKursiyerSoyad}`.replace(/;/g, ",");
                        const telNo = String(veri.telefon || "-").replace(/;/g, ",");
                        const yas = String(veri.yas || "-").replace(/;/g, ",");
                        const meslek = String(veri.meslek || "-").replace(/;/g, ",");
                        const motosiklet = String(veri.motosiklet || "-").replace(/;/g, ",");
                        const tecrube = String(veri.tecrube || "-").replace(/;/g, ",");
                        const paketMetni = veri.paketler && Array.isArray(veri.paketler) && veri.paketler.length > 0 ? veri.paketler.map(p => paketHaritasi[p] || p).join(" + ") : "Seçim Yok";
                        const durum = durumMetinHaritasi[sDurum] || sDurum;
                        const tBas = veri.egitimBaslangicTarihi || "-";
                        const tBit = veri.egitimBitisTarihi || "-";
                        const yoneticiNotu = String(veri.not || "Not Yok").replace(/;/g, ",").replace(/\n/g, " ");

                        csvIcerik += `"${tamAd}";"${telNo}";"${yas}";"${meslek}";"${motosiklet}";"${tecrube}";"${paketMetni.replace(/"/g, '""')}";"${durum}";"${tBas}";"${tBit}";"${yoneticiNotu.replace(/"/g, '""')}"\n`;
                    }
                });

                const blob = new Blob([csvIcerik], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement("a");
                link.setAttribute("href", URL.createObjectURL(blob));
                link.setAttribute("download", `FBA_Kursiyer_Raporu_${new Date().toISOString().slice(0,10)}.csv`);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            });
        }

        window.detayGoster = function(id) {
            const basvuru = tumBasvurular.find(b => b.id === id);
            if (basvuru) {
                document.getElementById('modal-isim').innerText = String(basvuru.ad || "") + " " + String(basvuru.soyad || "");
                document.getElementById('modal-yas').innerText = basvuru.yas || "-";
                document.getElementById('modal-meslek').innerText = basvuru.meslek || "-";
                document.getElementById('modal-motosiklet').innerText = basvuru.motosiklet || "-";
                document.getElementById('modal-tecrube').innerText = basvuru.tecrube || "-";
                document.getElementById('modal-neden').innerText = basvuru.neden || "Belirtilmemiş";
                document.getElementById('modal-not-input').value = basvuru.not || "";
                
                // Yenilenen Lüks İki Tarih Değerini Eşleme
                document.getElementById('modal-tarih-baslangic-input').value = basvuru.egitimBaslangicTarihi || "";
                document.getElementById('modal-tarih-bitis-input').value = basvuru.egitimBitisTarihi || "";
                
                document.getElementById('modal-not-kaydet-btn').setAttribute('onclick', `notKaydet('${basvuru.id}')`);
                document.getElementById('modal-randevu-kaydet-btn').setAttribute('onclick', `randevuKaydet('${basvuru.id}')`);
                
                document.getElementById('detay-modal').style.display = 'flex';
            }
        };

        window.modalKapat = function() {
            document.getElementById('detay-modal').style.display = 'none';
        };

        if (aramaInput) aramaInput.addEventListener('input', listeleyiGuncelle);
        if (durumFiltre) durumFiltre.addEventListener('change', listeleyiGuncelle);

        onSnapshot(collection(db, "basvurular"), (snapshot) => {
            sonSnapshotVerisi = snapshot;
            metrikleriHesaplaVeGuncelle();
        }, (error) => console.error("Veri akış hatası:", error));
    }

    // --- Fiyat Veri Kontrolü ve Eşzamanlama ---
    const fiyatFormu = document.getElementById('admin-fiyat-form');
    if (fiyatFormu || document.getElementById('goster-fiyat-teorik')) {
        onSnapshot(doc(db, "ayarlar", "fiyatlar"), (docSnap) => {
            if (docSnap.exists()) {
                const veriler = docSnap.data();
                
                if (fiyatFormu) {
                    document.getElementById('fiyat-input-teorik').value = veriler.teorik || "";
                    document.getElementById('fiyat-input-kapali').value = veriler.kapali || "";
                    document.getElementById('fiyat-input-yol').value = veriler.yol || "";
                    document.getElementById('fiyat-input-tum').value = veriler.tum || "";
                }

                if (document.getElementById('goster-fiyat-teorik')) {
                    document.getElementById('goster-fiyat-teorik').innerText = (veriler.teorik || "0") + " TL";
                    document.getElementById('goster-fiyat-kapali').innerText = (veriler.kapali || "0") + " TL";
                    document.getElementById('goster-fiyat-yol').innerText = (veriler.yol || "0") + " TL";
                    document.getElementById('goster-fiyat-tum').innerText = (veriler.tum || "0") + " TL";
                }

                aktifFiyatlar.teorik = veriler.teorik || "0";
                aktifFiyatlar.kapali = veriler.kapali || "0";
                aktifFiyatlar.yol = veriler.yol || "0";
                aktifFiyatlar.tum = veriler.tum || "0";

                if (tabloGovdesi && sonSnapshotVerisi) {
                    metrikleriHesaplaVeGuncelle();
                }
            }
        }, (error) => console.error("Fiyat senkronizasyon hatası:", error));
    }

    if (fiyatFormu) {
        fiyatFormu.addEventListener('submit', async function (e) {
            e.preventDefault();
            const btn = fiyatFormu.querySelector('button');
            btn.innerText = "Kaydediliyor...";
            btn.disabled = true;

            try {
                await setDoc(doc(db, "ayarlar", "fiyatlar"), {
                    teorik: document.getElementById('fiyat-input-teorik').value,
                    kapali: document.getElementById('fiyat-input-kapali').value,
                    yol: document.getElementById('fiyat-input-yol').value,
                    tum: document.getElementById('fiyat-input-tum').value
                });
                alert("Fiyatlar başarıyla güncellendi.");
            } catch (error) {
                console.error("Fiyat güncelleme hatası:", error);
                alert("Fiyatlar kaydedilirken bir hata oluştu.");
            } finally {
                btn.innerText = "Fiyatları Güncelle";
                btn.disabled = false;
            }
        });
    }

    const tumPaket = document.getElementById('paket-tum');
    const digerPaketler = [document.getElementById('paket-teorik'), document.getElementById('paket-kapali'), document.getElementById('paket-yol')];

    if (tumPaket && digerPaketler[0]) {
        function paketYonetimi(e) {
            if (e.target === tumPaket && tumPaket.checked) {
                digerPaketler.forEach(p => p.checked = false);
            } else if (e.target !== tumPaket) {
                if (digerPaketler.every(p => p.checked)) {
                    tumPaket.checked = true;
                    digerPaketler.forEach(p => p.checked = false);
                } else if (digerPaketler.some(p => p.checked)) {
                    tumPaket.checked = false;
                }
            }
        }
        [tumPaket, ...digerPaketler].forEach(p => p.addEventListener('change', paketYonetimi));
    }
});

// --- Küresel Window Fonksiyonları ---
window.durumDegistir = async function(id, yeniDurum) {
    try {
        await updateDoc(doc(getFirestore(), "basvurular", id), { durum: yeniDurum });
    } catch (error) {
        console.error("Durum güncellenirken hata:", error);
    }
};

window.basvuruSil = async function(id) {
    if (confirm("Bu kursiyer kaydını kalıcı olarak silmek istediğinize emin misiniz?")) {
        try {
            await deleteDoc(doc(getFirestore(), "basvurular", id));
        } catch (error) {
            console.error("Kayıt silinirken hata:", error);
        }
    }
};

window.notKaydet = async function(id) {
    const notMetni = document.getElementById('modal-not-input').value;
    const btn = document.getElementById('modal-not-kaydet-btn');
    const orjinalMetin = btn.innerText;
    btn.innerText = "Kaydediliyor...";
    btn.disabled = true;

    try {
        await updateDoc(doc(getFirestore(), "basvurular", id), { not: notMetni });
        alert("Not başarıyla kaydedildi.");
    } catch (error) {
        console.error("Not kaydetme hatası:", error);
        alert("Not kaydedilirken bir hata oluştu.");
    } finally {
        btn.innerText = orjinalMetin;
        btn.disabled = false;
    }
};

window.randevuKaydet = async function(id) {
    const baslangicVerisi = document.getElementById('modal-tarih-baslangic-input').value;
    const bitisVerisi = document.getElementById('modal-tarih-bitis-input').value;
    const btn = document.getElementById('modal-randevu-kaydet-btn');
    const orjinalMetin = btn.innerText;
    btn.innerText = "Planlanıyor...";
    btn.disabled = true;

    try {
        await updateDoc(doc(getFirestore(), "basvurular", id), { 
            egitimBaslangicTarihi: baslangicVerisi,
            egitimBitisTarihi: bitisVerisi
        });
        alert("Eğitim tarih aralığı başarıyla planlandı.");
    } catch (error) {
        console.error("Randevu planlama hatası:", error);
        alert("Randevu kaydedilirken bir hata oluştu.");
    } finally {
        btn.innerText = orjinalMetin;
        btn.disabled = false;
    }
};