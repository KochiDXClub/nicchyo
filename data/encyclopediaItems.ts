export type Rarity = 'normal' | 'rare' | 'super_rare';

export type EncyclopediaItem = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: Rarity;
  hint: string;
  category: 'food' | 'craft' | 'seasonal';
  locationName?: string;
  // 簡易的な判定用
  trigger: {
    type: 'qr' | 'gps' | 'both';
    qrValue?: string;
    lat?: number;
    lng?: number;
    radius?: number; // meters
  };
};

export const ENCYCLOPEDIA_ITEMS: EncyclopediaItem[] = [
  {
    id: 'imoten',
    name: 'いも天',
    emoji: '🍠',
    description: '日曜市といえばこれ！ホクホクのさつまいもを厚めの衣で揚げた、行列必至の名物です。外はカリッと、中はしっとり甘い。',
    rarity: 'normal',
    hint: '大橋通り周辺の香ばしい匂いをたどってみて。',
    category: 'food',
    locationName: '大橋通り周辺',
    trigger: {
      type: 'gps',
      lat: 33.559,
      lng: 133.535,
      radius: 100
    }
  },
  {
    id: 'inakazushi',
    name: '田舎寿司',
    emoji: '🍣',
    description: 'りゅうきゅう（蓮芋）や筍、椎茸など、山の幸をふんだんに使った高知の伝統的なお寿司。柚子の酢がきいた酢飯が特徴です。',
    rarity: 'normal',
    hint: 'お惣菜がたくさん並んでいるお店を探して。',
    category: 'food',
    trigger: {
      type: 'qr',
      qrValue: 'item_inakazushi'
    }
  },
  {
    id: 'hiyashiame',
    name: 'ひやしあめ',
    emoji: '🥤',
    description: '生姜のきいた甘い飲み物。夏は氷でキリッと、冬は温めても美味しい、日曜市の定番ドリンクです。',
    rarity: 'normal',
    hint: '「ひやしあめ」の旗が立っているお店があるよ。',
    category: 'food',
    trigger: {
      type: 'qr',
      qrValue: 'item_hiyashiame'
    }
  },
  {
    id: 'tosahamono',
    name: '土佐刃物',
    emoji: '🔪',
    description: '400年以上の歴史を持つ、高知の伝統工芸品。切れ味抜群で丈夫な包丁や鎌は、全国の料理人や農家に愛されています。',
    rarity: 'normal',
    hint: '鉄を叩く音が聞こえてくるかも？',
    category: 'craft',
    trigger: {
      type: 'qr',
      qrValue: 'item_tosahamono'
    }
  },
  {
    id: 'niitakanashi',
    name: '新高梨',
    emoji: '🍐',
    description: '「梨の王様」と呼ばれる、高知発祥の巨大な梨。香りが高く、非常にジューシー。秋の日曜市を代表する味覚です。',
    rarity: 'rare',
    hint: '秋（9月〜10月）の時期にしか現れないよ。',
    category: 'seasonal',
    trigger: {
      type: 'gps',
      lat: 33.560,
      lng: 133.533,
      radius: 200
    }
  },
  {
    id: 'konatsu',
    name: '小夏',
    emoji: '🍋',
    description: '初夏を告げる高知の柑橘。白い甘皮と一緒に食べるのが特徴で、爽やかな甘酸っぱさが口いっぱいに広がります。',
    rarity: 'rare',
    hint: '春から夏にかけて、黄色い果実が並ぶ頃に探してみて。',
    category: 'seasonal',
    trigger: {
      type: 'qr',
      qrValue: 'item_konatsu'
    }
  },
  {
    id: 'sansai',
    name: '幻の山菜',
    emoji: '🌿',
    description: '朝一番にしか並ばない、地元の通だけが知っている希少な山菜。売り切れ御免のスーパーレアアイテムです。',
    rarity: 'super_rare',
    hint: '日曜日の朝、一番早い時間帯に探してみよう。',
    category: 'food',
    trigger: {
      type: 'gps',
      lat: 33.562,
      lng: 133.530,
      radius: 50
    }
  }
];
