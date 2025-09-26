/**
 * YuiHub 日本語テキスト処理ユーティリティ
 * 
 * 日本語検索対応のための以下の機能を提供:
 * - テキスト正規化 (NFKC形式、空白文字統一)
 * - 日本語分かち書き (tiny-segmenter使用)
 * - ストップワード除去
 * - 検索クエリ処理
 */

import TinySegmenter from 'tiny-segmenter';

// 日本語分割器のインスタンス
const segmenter = new TinySegmenter();

// 日本語ストップワード（助詞・助動詞・基本語）
const JAPANESE_STOPWORDS = new Set([
    // 助詞
    'は', 'が', 'を', 'に', 'で', 'と', 'も', 'へ', 'から', 'まで', 'より', 'の', 'や', 'か',
    // 助動詞・動詞
    'する', 'した', 'される', 'なる', 'なった', 'ある', 'あり', 'です', 'である', 'だ', 'であり',
    // 形式名詞・代名詞
    'こと', 'もの', 'ため', 'これ', 'それ', 'あれ', 'ここ', 'そこ', 'あそこ',
    // 接続詞・副詞
    'そして', 'また', 'しかし', 'ただし', 'ただ', 'とても', 'かなり', 'すごく',
    // 記号・数字（1文字）
    '、', '。', '！', '？', '（', '）', '「', '」', '『', '』', '1', '2', '3', '4', '5'
]);

/**
 * テキストを正規化する
 * - Unicode NFKC形式に統一
 * - 空白文字を統一
 * - 前後の空白を除去
 * 
 * @param {string} text 対象テキスト
 * @returns {string} 正規化されたテキスト
 */
export function normalizeJa(text = '') {
    return String(text ?? '')
        .trim()
        .normalize('NFKC')
    // ひらがな→カタカナ（検索時とインデックス時の表記ゆれを吸収）
    .replace(/[ぁ-ゖ]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60))
        .replace(/\s+/g, ' ');  // 複数の空白文字を1つの半角スペースに統一
}

/**
 * 日本語テキストを分かち書きしてトークン化
 * - tiny-segmenterで形態素解析
 * - ストップワード除去
 * - 空のトークン除去
 * 
 * @param {string} text 対象テキスト
 * @returns {string} スペース区切りのトークン文字列
 */
export function tokenizeJa(text = '') {
    const normalized = normalizeJa(text);
    if (!normalized) return '';
    
    // 分かち書き実行
    const rawTokens = segmenter.segment(normalized)
        .filter(token => {
            // 空文字、スペースのみ、ストップワードを除去
            const trimmed = token.trim();
            return trimmed.length > 0 && !JAPANESE_STOPWORDS.has(trimmed);
        });

    // 反復語ユニット分割（カタカナ連続の完全反復のみ対象）
    const expanded = [];
    for (const tok of rawTokens) {
        const parts = splitRepeatingKatakana(tok);
        for (const p of parts) expanded.push(p);
    }
    
    return expanded.join(' ');
}

/**
 * 検索クエリを処理する
 * - URL デコード対応
 * - 日本語トークン化
 * 
 * @param {string} query 検索クエリ（URLエンコード済み可能）
 * @returns {string} 処理された検索クエリ
 */
export function tokenizeQuery(query = '') {
    try {
        // URLデコードを試行（既にデコード済みの場合はエラーになる可能性があるが問題なし）
        const decoded = decodeURIComponent(query);
        return tokenizeJa(decoded);
    } catch (e) {
        // URLデコードに失敗した場合は元の文字列を使用
        return tokenizeJa(query);
    }
}

/**
 * 複数の文字列を結合してトークン化
 * インデックス構築時に複数フィールドを統合する際に使用
 * 
 * @param {...string} texts 結合対象の文字列群
 * @returns {string} 統合・トークン化された文字列
 */
export function combineAndTokenize(...texts) {
    const combined = texts
        .filter(text => text != null)
        .map(text => String(text))
        .join(' ');
    return tokenizeJa(combined);
}

/**
 * デバッグ用: トークン化の詳細情報を取得
 * 
 * @param {string} text 対象テキスト
 * @returns {object} 詳細情報オブジェクト
 */
export function debugTokenization(text) {
    const normalized = normalizeJa(text);
    const rawTokens = segmenter.segment(normalized);
    const filteredTokens = rawTokens.filter(token => {
        const trimmed = token.trim();
        return trimmed.length > 0 && !JAPANESE_STOPWORDS.has(trimmed);
    });
    const expanded = filteredTokens.flatMap(splitRepeatingKatakana);
    return {
        original: text,
        normalized,
        rawTokens,
        filteredTokens,
        expandedTokens: expanded,
        result: expanded.join(' ')
    };
}

/**
 * カタカナ反復語をユニット分割する
 * 例: "ミャオミャオ" → ["ミャオ","ミャオ"]
 * 完全反復（同一ユニットの繰り返し）のみを対象。該当しない場合は元のトークンを返す。
 */
function splitRepeatingKatakana(token) {
    const t = token.trim();
    if (t.length < 4) return [t]; // 2文字×2回以上のケースを主対象
    // カタカナ + 長音符のみ
    if (!/^[\u30A0-\u30FFー]+$/.test(t)) return [t];
    const len = t.length;
    for (let unit = 2; unit <= Math.floor(len / 2); unit++) {
        if (len % unit !== 0) continue;
        const base = t.slice(0, unit);
        if (base.repeat(len / unit) === t) {
            return Array(len / unit).fill(base);
        }
    }
    return [t];
}