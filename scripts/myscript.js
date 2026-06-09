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

    // --- Telefon Numarasını WhatsApp Formatına Getiren Yardımcı Fonksiyon ---
    const whatsappNumarasiTemizle = (tel) => {
        if (!tel) return "";
        let temiz = String(tel).replace(/[^0-9]/g, ''); // Sadece rakamları bırak
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

        const listeleyiGuncelle = () => {
            if (tumBasvurular.length === 0) {
                tabloGovdesi.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Sistemde kayıtlı başvuru bulunmamaktadır.</td></tr>`;
                return;
            }

            const aramaKelimesi = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
            const secilenDurum = durumFiltre ? durumFiltre.value : "hepsi";

            let htmlIcerik = "";
            let filtrelenmisAdet = 0;

            tumBasvurular.forEach((veri) => {
                const kKursiyerAd = String(veri.ad || "");
                const kKursiyerSoyad = String(veri.soyad || "");
                const adSoyad = (kKursiyerAd + " " + kKursiyerSoyad).toLowerCase();
                const telefon = veri.telefon ? String(veri.telefon).toLowerCase() : "";
                
                const aramaUyumlu = adSoyad.includes(aramaKelimesi) || telefon.includes(aramaKelimesi);
                const durumUyumlu = secilenDurum === "hepsi" || String(veri.durum || "beklemede") === secilenDurum;

                if (aramaUyumlu && durumUyumlu) {
                    filtrelenmisAdet++;
                    
                    const paketMetni = veri.paketler && Array.isArray(veri.paketler) && veri.paketler.length > 0 
                        ? veri.paketler.map(p => paketHaritasi[p] || p).join(", ") 
                        : "Seçim Yok";

                    // WhatsApp için numara temizliği ve mesaj encode işlemleri
                    const temizNumara = whatsappNumarasiTemizle(veri.telefon);
                    const taslakMesaj = encodeURIComponent(`Merhaba ${kKursiyerAd} ${kKursiyerSoyad},\n\nFatih Barış Akademi web sitemiz üzerinden yapmış olduğunuz "Motosiklet Güvenli ve İleri Sürüş Teknikleri" ön başvurunuz tarafımıza ulaşmıştır. Eğitim sürecini planlamak ve detayları görüşmek adına müsait olduğunuz bir zaman dilimini iletebilir misiniz?\n\nİyi günler, güvenli sürüşler dileriz.`);

                    htmlIcerik += `
                        <tr>
                            <td>
                                <b>${kKursiyerAd} ${kKursiyerSoyad}</b><br>
                                <small style="color: #64748b;">Yaş: ${veri.yas || "-"} | ${veri.meslek || "-"}</small>
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
                            <td><span class="status-badge status-${veri.durum || "beklemede"}">${veri.durum || "beklemede"}</span></td>
                            <td>
                                <select class="action-btn" onchange="durumDegistir('${veri.id}', this.value)">
                                    <option value="beklemede" ${veri.durum === 'beklemede' ? 'selected' : ''}>Beklemede</option>
                                    <option value="arandi" ${veri.durum === 'arandi' ? 'selected' : ''}>Arandı</option>
                                    <option value="onaylandi" ${veri.durum === 'onaylandi' ? 'selected' : ''}>Onaylandı</option>
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
                ? `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Arama kriterlerine uygun sonuç bulunamadı.</td></tr>` 
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

                countToplam++;
                const sDurum = veri.durum || "beklemede";
                if (sDurum === "beklemede") countBeklemede++;
                else if (sDurum === "arandi") countArandi++;
                else if (sDurum === "onaylandi") countOnaylandi++;

                if (veri.paketler && Array.isArray(veri.paketler)) {
                    veri.paketler.forEach(p => {
                        if (p === "tum") { dTum++; if (sDurum === "onaylandi") toplamCiro += fiyatTum; }
                        else if (p === "teorik") { dTeorik++; if (sDurum === "onaylandi") toplamCiro += fiyatTeorik; }
                        else if (p === "kapali") { dKapali++; if (sDurum === "onaylandi") toplamCiro += fiyatKapali; }
                        else if (p === "yol") { dYol++; if (sDurum === "onaylandi") toplamCiro += fiyatYol; }
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

            listeleyiGuncelle();
        };

        if (exportBtn) {
            exportBtn.addEventListener('click', function() {
                if (tumBasvurular.length === 0) {
                    alert("Dışa aktarılacak herhangi bir başvuru kaydı bulunmamaktadır.");
                    return;
                }
                const aramaKelimesi = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
                const secilenDurum = durumFiltre ? durumFiltre.value : "hepsi";

                let csvIcerik = "\uFEFFKursiyer Adı Soyadı;Telefon;Yaş;Meslek;Motosiklet;Tecrübe;Talep Edilen Eğitim;Durum;Yönetici Notu\n";

                tumBasvurular.forEach((veri) => {
                    const kKursiyerAd = String(veri.ad || "");
                    const kKursiyerSoyad = String(veri.soyad || "");
                    const adSoyad = (kKursiyerAd + " " + kKursiyerSoyad).toLowerCase();
                    const telefon = veri.telefon ? String(veri.telefon).toLowerCase() : "";
                    
                    if ((adSoyad.includes(aramaKelimesi) || telefon.includes(aramaKelimesi)) && (secilenDurum === "hepsi" || String(veri.durum || "beklemede") === secilenDurum)) {
                        const tamAd = `${kKursiyerAd} ${kKursiyerSoyad}`.replace(/;/g, ",");
                        const telNo = String(veri.telefon || "-").replace(/;/g, ",");
                        const yas = String(veri.yas || "-").replace(/;/g, ",");
                        const meslek = String(veri.meslek || "-").replace(/;/g, ",");
                        const motosiklet = String(veri.motosiklet || "-").replace(/;/g, ",");
                        const tecrube = String(veri.tecrube || "-").replace(/;/g, ",");
                        const paketMetni = veri.paketler && Array.isArray(veri.paketler) && veri.paketler.length > 0 ? veri.paketler.map(p => paketHaritasi[p] || p).join(" + ") : "Seçim Yok";
                        const durum = String(veri.durum || "beklemede");
                        const yoneticiNotu = String(veri.not || "Not Yok").replace(/;/g, ",").replace(/\n/g, " ");

                        csvIcerik += `"${tamAd}";"${telNo}";"${yas}";"${meslek}";"${motosiklet}";"${tecrube}";"${paketMetni.replace(/"/g, '""')}";"${durum}";"${yoneticiNotu.replace(/"/g, '""')}"\n`;
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
                document.getElementById('modal-not-kaydet-btn').setAttribute('onclick', `notKaydet('${basvuru.id}')`);
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

    // --- Kayıt Sayfası Çoklu Paket Seçim Mantığı ---
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