/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

(function () {
  'use strict';

  var ORDER_ENDPOINT =
    'https://script.google.com/macros/s/AKfycbyewxWYFwfJUggmTvUP2c6YrgCCkMUGdH5ZXYZJEkQaX7NI3TMW_s4w1UABeFNQqUUb/exec';

  var ORDERS_CSV_URL =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj2XFOMljt3LY2Cjp-CZdopyAxyBGdC3rqfGnowKB5uOkca5fiHDqy0Z9vVY9TkaklY5WDbQmq5Lxb/pub?gid=0&single=true&output=csv';

  var MOOD_FILTERS = [
    { key: 'all', label: 'ทั้งหมด' },
    { key: 'fresh', label: 'Fresh' },
    { key: 'sweet', label: 'Sweet' },
    { key: 'confident', label: 'Confident' },
    { key: 'romance', label: 'Romance' }
  ];

  var TYPE_LABELS = { spray: 'น้ำหอมฉีดตัว', rollon: 'โรลออน' };

  /* ---------- helpers ---------- */
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatPrice(n) {
    var num = Number(n);
    return isNaN(num) ? String(n) : num.toLocaleString('th-TH');
  }

  /* ==========================================================
     1) product.html
     ========================================================== */
  function initProductPage() {
    var list = document.getElementById('product-list');
    var bar = document.getElementById('filter-bar');
    if (!list || !bar) return;

    var products = [];
    var validKeys = MOOD_FILTERS.map(function (f) { return f.key; });

    // อ่าน ?mood=xxx (ถ้าไม่ถูกต้องให้ใช้ "all")
    var requested = (new URLSearchParams(window.location.search).get('mood') || '').toLowerCase();
    var current = validKeys.indexOf(requested) !== -1 ? requested : 'all';

    // สร้างปุ่มกรอง
    bar.innerHTML = '';
    MOOD_FILTERS.forEach(function (f) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'filter-btn';
      btn.textContent = f.label;
      btn.dataset.filter = f.key;
      if (f.key !== 'all') btn.dataset.mood = f.key; // ให้เส้นใต้ปุ่มได้สี mood
      btn.addEventListener('click', function () {
        setFilter(f.key, true);
      });
      bar.appendChild(btn);
    });

    function setFilter(key, updateUrl) {
      current = key;
      Array.prototype.forEach.call(bar.querySelectorAll('.filter-btn'), function (b) {
        var active = b.dataset.filter === key;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      if (updateUrl && window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (key === 'all') url.searchParams.delete('mood');
        else url.searchParams.set('mood', key);
        history.replaceState(null, '', url);
      }
      render();
    }

    function buildItemName(p) {
      return p.size ? p.name + ' ' + p.size : p.name;
    }

    function render() {
      var shown = products.filter(function (p) {
        return current === 'all' || p.mood === current;
      });

      if (!shown.length) {
        list.innerHTML = '<p class="text-center">ไม่พบสินค้าในหมวดนี้</p>';
        return;
      }

      list.innerHTML = '';
      shown.forEach(function (p) {
        var itemName = buildItemName(p);
        var orderUrl =
          'order.html?item=' + encodeURIComponent(itemName) +
          '&price=' + encodeURIComponent(p.price);
        var moodLabel = p.mood ? p.mood.charAt(0).toUpperCase() + p.mood.slice(1) : '';
        var meta = p.size || TYPE_LABELS[p.type] || '';

        var card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.mood = p.mood;
        card.innerHTML =
          '<div class="product-card__media">' +
            '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
          '</div>' +
          '<div class="product-card__body">' +
            '<div class="product-card__mood"><span class="mood-dot"></span>' + esc(moodLabel) + '</div>' +
            '<h3 class="product-card__title">' + esc(p.name) + '</h3>' +
            '<div class="product-card__meta">' + esc(meta) + '</div>' +
            '<div class="product-card__price">' + formatPrice(p.price) + ' บาท</div>' +
            '<a class="btn btn--block btn--small" href="' + orderUrl + '">สั่งซื้อ</a>' +
          '</div>';
        list.appendChild(card);
      });
    }

    fetch('products.json')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        setFilter(current, false);
      })
      .catch(function (err) {
        console.error(err);
        list.innerHTML = '<p class="text-center">โหลดข้อมูลสินค้าไม่สำเร็จ กรุณาลองใหม่อีกครั้ง</p>';
      });
  }

  /* ==========================================================
     2) order.html
     ========================================================== */
  function initOrderPage() {
    var form = document.getElementById('orderForm');
    if (!form) return;

    // เติม item และ price จาก URL ลงช่อง #items และ #total ทันที
    var params = new URLSearchParams(window.location.search);
    var itemField = document.getElementById('items');
    var totalField = document.getElementById('total');
    var item = params.get('item');
    var price = params.get('price');
    if (itemField && item !== null) itemField.value = item;
    if (totalField && price !== null) totalField.value = price;

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var payload = {
        customerName: document.getElementById('customerName').value.trim(),
        contact: document.getElementById('contact').value.trim(),
        items: document.getElementById('items').value.trim(),
        total: document.getElementById('total').value.trim(),
        note: document.getElementById('note').value.trim()
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = 'thankyou.html'; })
        .catch(error => {
          console.error(error);
          if (submitBtn) submitBtn.disabled = false;
          alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
        });
    });
  }

  /* ==========================================================
     3) admin.html
     ========================================================== */

  // parse CSV เอง: รองรับ "..." ครอบค่า, "" แทน ", และขึ้นบรรทัดใหม่ในช่อง
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var inQuotes = false;

    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

    for (var i = 0; i < text.length; i++) {
      var ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }

    // แถวสุดท้ายที่ไม่มีขึ้นบรรทัดใหม่ปิดท้าย
    if (field !== '' || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่างทิ้ง
    return rows.filter(function (r) {
      return r.some(function (c) { return c.trim() !== ''; });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector('#ordersTable tbody');
    if (!tbody) return;

    var COLS = 6;

    function showMessage(msg) {
      tbody.innerHTML = '';
      var tr = document.createElement('tr');
      var td = document.createElement('td');
      td.colSpan = COLS;
      td.textContent = msg;
      td.style.textAlign = 'center';
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    showMessage('กำลังโหลดข้อมูล...');

    fetch(ORDERS_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);
        rows.shift(); // ตัดแถวหัวตาราง

        if (!rows.length) {
          showMessage('ยังไม่มีรายการสั่งซื้อ');
          return;
        }

        // Sheet เพิ่มแถวใหม่ต่อท้ายเสมอ → กลับลำดับให้ล่าสุดขึ้นก่อน
        rows.reverse();

        tbody.innerHTML = '';
        rows.forEach(function (r) {
          var tr = document.createElement('tr');
          // คอลัมน์: วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ
          for (var c = 0; c < COLS; c++) {
            var td = document.createElement('td');
            var value = (r[c] || '').trim();
            if (c === 4 && value !== '' && !isNaN(Number(value))) {
              value = formatPrice(value) + ' บาท';
            }
            td.textContent = value; // textContent กัน HTML/สคริปต์แปลกปลอมจากข้อมูลลูกค้า
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        showMessage('โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง');
      });
  }

  /* ---------- start ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initProductPage();
    initOrderPage();
    initAdminPage();
  });
})();
