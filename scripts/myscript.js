import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, serverTimestamp, 
    query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, setDoc
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
                if (ilerleme < 1) element.dataset.animationId = requestAnimationFrame(animasyonAdimi);
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
                alert("Giriş Başarısız: Hatalı kullanıcı adı veya şifre patron.");
                btn.innerText = "Giriş Yap";
                btn.disabled = false;
            }
        });
    }

    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = "admin-login.html";
            });
        });
    }

    onAuthStateChanged(auth, (user) => {
        const suankiSayfa = window.location.pathname;
        if (suankiSayfa.includes("admin-panel.html") && !user) {
            window.location.href = "admin-login.html";
        }
        if (suankiSayfa.includes("admin-login.html") && user) {
            window.location.href = "admin-panel.html";
        }
    });

    const tabloGovdesi = document.getElementById('basvuru-tablo-govdesi');
    if (tabloGovdesi) {
        const q = query(collection(db, "basvurular"), orderBy("kayitTarihi", "desc"));
        let tumBasvurular = [];
        const aramaInput = document.getElementById('admin-arama-input');
        const durumFiltre = document.getElementById('admin-durum-filtre');

        const listeleyiGuncelle = () => {
            if (tumBasvurular.length === 0) {
                tabloGovdesi.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Henüz hiç başvuru bulunmuyor patron.</td></tr>`;
                return;
            }

            const aramaKelimesi = aramaInput ? aramaInput.value.toLowerCase().trim() : "";
            const secilenDurum = durumFiltre ? durumFiltre.value : "hepsi";

            let htmlIcerik = "";
            let filtrelenmisAdet = 0;

            tumBasvurular.forEach((veri) => {
                const adSoyad = (veri.ad + " " + veri.soyad).toLowerCase();
                const telefon = veri.telefon ? veri.telefon.toLowerCase() : "";
                
                const aramaUyumlu = adSoyad.includes(aramaKelimesi) || telefon.includes(aramaKelimesi);
                const durumUyumlu = secilenDurum === "hepsi" || veri.durum === secilenDurum;

                if (aramaUyumlu && durumUyumlu) {
                    filtrelenmisAdet++;
                    const paketMetni = veri.paketler && veri.paketler.length > 0 ? veri.paketler.join(", ") : "Seçim Yok";
                    htmlIcerik += `
                        <tr>
                            <td>
                                <b>${veri.ad} ${veri.soyad}</b><br>
                                <small style="color: #64748b;">Yaş: ${veri.yas} | ${veri.meslek}</small>
                            </td>
                            <td>
                                <a href="tel:${veri.telefon}" style="color: #ff4500; text-decoration: none; font-weight: 500;">
                                    <i class="fa-solid fa-phone"></i> ${veri.telefon}
                                </a>
                            </td>
                            <td>
                                <b>${veri.motosiklet}</b><br>
                                <small style="color: #64748b;">Tecrübe: ${veri.tecrube}</small>
                            </td>
                            <td><span style="color: #ffffff; font-size: 14px;">${paketMetni}</span></td>
                            <td><span class="status-badge status-${veri.durum}">${veri.durum}</span></td>
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

            if (filtrelenmisAdet === 0) {
                tabloGovdesi.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 40px;">Arama kriterlerine uygun sonuç bulunamadı patron.</td></tr>`;
            }
        };

        window.detayGoster = function(id) {
            const basvuru = tumBasvurular.find(b => b.id === id);
            if (basvuru) {
                document.getElementById('modal-isim').innerText = basvuru.ad + " " + basvuru.soyad;
                document.getElementById('modal-yas').innerText = basvuru.yas;
                document.getElementById('modal-meslek').innerText = basvuru.meslek;
                document.getElementById('modal-motosiklet').innerText = basvuru.motosiklet;
                document.getElementById('modal-tecrube').innerText = basvuru.tecrube;
                document.getElementById('modal-neden').innerText = basvuru.neden || "Belirtilmemiş";
                document.getElementById('detay-modal').style.display = 'flex';
            }
        };

        window.modalKapat = function() {
            document.getElementById('detay-modal').style.display = 'none';
        };

        if (aramaInput) aramaInput.addEventListener('input', listeleyiGuncelle);
        if (durumFiltre) durumFiltre.addEventListener('change', listeleyiGuncelle);

        onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                tumBasvurular = [];
                document.getElementById('stat-toplam').innerText = "0";
                document.getElementById('stat-beklemede').innerText = "0";
                document.getElementById('stat-arandi').innerText = "0";
                document.getElementById('stat-onaylandi').innerText = "0";
                listeleyiGuncelle();
                return;
            }

            tumBasvurular = [];
            let countToplam = 0;
            let countBeklemede = 0;
            let countArandi = 0;
            let countOnaylandi = 0;

            snapshot.forEach((docSnap) => {
                const veri = docSnap.data();
                tumBasvurular.push({ id: docSnap.id, ...veri });

                countToplam++;
                if (veri.durum === "beklemede") countBeklemede++;
                else if (veri.durum === "arandi") countArandi++;
                else if (veri.durum === "onaylandi") countOnaylandi++;
            });

            document.getElementById('stat-toplam').innerText = countToplam;
            document.getElementById('stat-beklemede').innerText = countBeklemede;
            document.getElementById('stat-arandi').innerText = countArandi;
            document.getElementById('stat-onaylandi').innerText = countOnaylandi;

            listeleyiGuncelle();
        });
    }

    const fiyatFormu = document.getElementById('admin-fiyat-form');
    if (fiyatFormu) {
        onSnapshot(doc(db, "ayarlar", "fiyatlar"), (docSnap) => {
            if (docSnap.exists()) {
                const veriler = docSnap.data();
                document.getElementById('fiyat-input-teorik').value = veriler.teorik || "";
                document.getElementById('fiyat-input-kapali').value = veriler.kapali || "";
                document.getElementById('fiyat-input-yol').value = veriler.yol || "";
                document.getElementById('fiyat-input-tum').value = veriler.tum || "";
            }
        });

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
                alert("Fiyatlar başarıyla güncellendi patron!");
            } catch (error) {
                console.error("Fiyat güncelleme hatası:", error);
                alert("Fiyatlar kaydedilirken hata oluştu.");
            } finally {
                btn.innerText = "Fiyatları Güncelle";
                btn.disabled = false;
            }
        });
    }

    const gosterTeorik = document.getElementById('goster-fiyat-teorik');
    if (gosterTeorik) {
        onSnapshot(doc(db, "ayarlar", "fiyatlar"), (docSnap) => {
            if (docSnap.exists()) {
                const veriler = docSnap.data();
                document.getElementById('goster-fiyat-teorik').innerText = veriler.teorik + " TL";
                document.getElementById('goster-fiyat-kapali').innerText = veriler.kapali + " TL";
                document.getElementById('goster-fiyat-yol').innerText = veriler.yol + " TL";
                document.getElementById('goster-fiyat-tum').innerText = veriler.tum + " TL";
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
                const hepsiSecili = digerPaketler.every(p => p.checked);
                if (hepsiSecili) {
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

window.durumDegistir = async function(id, yeniDurum) {
    try {
        const basvuruRef = doc(db, "basvurular", id);
        await updateDoc(basvuruRef, { durum: yeniDurum });
    } catch (error) {
        console.error("Durum güncellenirken hata:", error);
    }
};

window.basvuruSil = async function(id) {
    if (confirm("Bu kursiyer kaydını kalıcı olarak silmek istediğine emin misin patron?")) {
        try {
            await deleteDoc(doc(db, "basvurular", id));
        } catch (error) {
            console.error("Kayıt silinirken hata:", error);
        }
    }
};