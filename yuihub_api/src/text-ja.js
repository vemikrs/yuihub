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
    const tokens = segmenter.segment(normalized)
        .filter(token => {
            // 空文字、スペースのみ、ストップワードを除去
            const trimmed = token.trim();
            return trimmed.length > 0 && !JAPANESE_STOPWORDS.has(trimmed);
        });
    
    return tokens.join(' ');
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
    
    return {
        original: text,
        normalized,
        rawTokens,
        filteredTokens,
        result: filteredTokens.join(' ')
    };
}