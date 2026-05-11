// ==================== 自动填充模块 ====================
// 地址/信用卡/密码表单自动填充
(function() {
  'use strict';

  let autofillData = JSON.parse(localStorage.getItem('f-autofill') || '{}');

  // 默认数据结构
  if (!autofill.profiles) autofill.profiles = [];
  if (!autofill.creditCards) autofill.creditCards = [];

  function getData() {
    return autofillData;
  }

  function saveData() {
    localStorage.setItem('f-autofill', JSON.stringify(autofillData));
  }

  function addProfile(profile) {
    autofillData.profiles.push(profile);
    saveData();
  }

  function removeProfile(index) {
    autofillData.profiles.splice(index, 1);
    saveData();
  }

  function addCreditCard(card) {
    autofillData.creditCards.push({
      ...card,
      number: btoa(card.number), // 简单编码
    });
    saveData();
  }

  function removeCreditCard(index) {
    autofillData.creditCards.splice(index, 1);
    saveData();
  }

  // 检测表单类型并填充
  const AUTOFILL_SCRIPT = `
    (function() {
      function detectFormType() {
        const inputs = document.querySelectorAll('input, select, textarea');
        const fields = {};
        inputs.forEach(input => {
          const name = (input.name || input.id || '').toLowerCase();
          const type = input.type?.toLowerCase() || '';
          const autocomplete = (input.autocomplete || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();

          // 姓名
          if (/name/.test(name) || /姓名/.test(placeholder) || autocomplete === 'name' || autocomplete === 'family-name' || autocomplete === 'given-name') {
            fields.name = fields.name || input;
          }
          // 邮箱
          if (type === 'email' || /email|邮件/.test(name + placeholder) || autocomplete === 'email') {
            fields.email = fields.email || input;
          }
          // 电话
          if (type === 'tel' || /phone|tel|手机|电话/.test(name + placeholder) || autocomplete === 'tel') {
            fields.phone = fields.phone || input;
          }
          // 地址
          if (/address|street|地址|街道/.test(name + placeholder) || autocomplete === 'street-address' || autocomplete === 'address-line1') {
            fields.address = fields.address || input;
          }
          // 城市
          if (/city|城市/.test(name + placeholder) || autocomplete === 'address-level2') {
            fields.city = fields.city || input;
          }
          // 省份
          if (/state|province|省份/.test(name + placeholder) || autocomplete === 'address-level1') {
            fields.state = fields.state || input;
          }
          // 邮编
          if (/zip|postal|邮编/.test(name + placeholder) || autocomplete === 'postal-code') {
            fields.zip = fields.zip || input;
          }
          // 国家
          if (/country|国家/.test(name + placeholder) || autocomplete === 'country') {
            fields.country = fields.country || input;
          }
          // 信用卡号
          if (/card.*number|卡号/.test(name + placeholder) || autocomplete === 'cc-number') {
            fields.ccNumber = fields.ccNumber || input;
          }
          // 信用卡过期
          if (/exp|过期|有效期/.test(name + placeholder) || autocomplete === 'cc-exp') {
            fields.ccExp = fields.ccExp || input;
          }
          // CVV
          if (/cvv|cvc|安全码/.test(name + placeholder) || autocomplete === 'cc-csc') {
            fields.ccCvv = fields.ccCvv || input;
          }
        });
        return fields;
      }

      const fields = detectFormType();
      if (Object.keys(fields).length > 0) {
        window.postMessage({ type: 'fb-autofill-detected', fields: Object.keys(fields) }, '*');
      }
    })();
  `;

  // 自动填充表单
  function fillForm(profile) {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    wv.executeJavaScript(`
      (function() {
        const profile = ${JSON.stringify(profile)};
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
          const name = (input.name || input.id || '').toLowerCase();
          const type = input.type?.toLowerCase() || '';
          const autocomplete = (input.autocomplete || '').toLowerCase();
          const placeholder = (input.placeholder || '').toLowerCase();
          const combined = name + ' ' + placeholder + ' ' + autocomplete;

          if (/name|姓名/.test(combined) && profile.name) {
            input.value = profile.name;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if ((type === 'email' || /email|邮件/.test(combined)) && profile.email) {
            input.value = profile.email;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if ((type === 'tel' || /phone|tel|手机|电话/.test(combined)) && profile.phone) {
            input.value = profile.phone;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/address|street|地址|街道/.test(combined) && profile.address) {
            input.value = profile.address;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/city|城市/.test(combined) && profile.city) {
            input.value = profile.city;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/state|province|省份/.test(combined) && profile.state) {
            input.value = profile.state;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/zip|postal|邮编/.test(combined) && profile.zip) {
            input.value = profile.zip;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
        });
      })()
    `).catch(() => {});
  }

  function fillCreditCard(card) {
    const wv = window.FBrowser.tabs.getActiveWebview();
    if (!wv) return;

    const number = atob(card.number);
    wv.executeJavaScript(`
      (function() {
        const card = ${JSON.stringify({...card, number})};
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          const name = (input.name || input.id || '').toLowerCase();
          const autocomplete = (input.autocomplete || '').toLowerCase();
          const combined = name + ' ' + autocomplete;

          if (/card.*number|卡号/.test(combined) || autocomplete === 'cc-number') {
            input.value = card.number;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/exp|过期|有效期/.test(combined) || autocomplete === 'cc-exp') {
            input.value = card.expiry;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/cvv|cvc|安全码/.test(combined) || autocomplete === 'cc-csc') {
            input.value = card.cvv;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
          if (/card.*name|持卡人/.test(combined) || autocomplete === 'cc-name') {
            input.value = card.holder;
            input.dispatchEvent(new Event('input', {bubbles:true}));
          }
        });
      })()
    `).catch(() => {});
  }

  window.FBrowser = window.FBrowser || {};
  window.FBrowser.autoFill = {
    getData, saveData, addProfile, removeProfile,
    addCreditCard, removeCreditCard, fillForm, fillCreditCard,
    AUTOFILL_SCRIPT,
  };
})();
