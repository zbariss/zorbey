import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "...", // Kendi gerçek apiKey değerini buraya yapıştır patron
  authDomain: "...", // Kendi gerçek authDomain değerini yapıştır
  projectId: "...", // Kendi gerçek projectId değerini yapıştır
  storageBucket: "...", // Kendi gerçek storageBucket değerini yapıştır
  messagingSenderId: "...", // Kendi gerçek messagingSenderId değerini yapıştır
  appId: "..." // Kendi gerçek appId değerini yapıştır
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

            const kursiyerVerisi = {
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
            };

            try {
                await addDoc(collection(db, "basvurular"), kursiyerVerisi);
                window.location.href = "onay.html";
            } catch (error) {
                console.error("Kayıt hatası:", error);
                alert("Bir hata oluştu, lütfen tekrar deneyiniz.");
                submitButon.innerText = orjinalButonMetni;
                submitButon.disabled = false;
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