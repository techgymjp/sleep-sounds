// 日本語と英語の切り替え（端末の言語が日本語なら日本語、それ以外は英語）
window.LANG = (navigator.language || 'ja').toLowerCase().startsWith('ja') ? 'ja' : 'en';
// L('日本語', 'English') … いまの言語のほうを返す
window.L = (ja, en) => (window.LANG === 'ja' ? ja : en);
document.documentElement.lang = window.LANG;
