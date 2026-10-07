export type GrandmaEventMessage = {
  id: string;
  subtitle: string;
  text: string;
  image?: string;
};

export type GrandmaEvent = {
  id: string;
  title: string;
  location: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  messages: GrandmaEventMessage[];
};

export const grandmaEvents: GrandmaEvent[] = [
  {
    id: 'kochi-castle-museum',
    title: '高知城歴史博物館',
    location: {
      lat: 33.5636875,
      lng: 133.5295,
      radiusMeters: 90,
    },
    messages: [
      {
        id: 'm1',
        subtitle: '高知城歴史博物館とは？',
        text: '土佐の歴史と文化をぎゅっと集めた学びの場所よ。城下町の物語がわかりやすく紹介されてるの。',
      },
      {
        id: 'm2',
        subtitle: '何ができる？',
        text: '常設展示で歴史をたどったり、企画展で季節ごとのテーマを楽しめるわ。ゆっくり見ても飽きないの。',
      },
      {
        id: 'm3',
        subtitle: '高知城歴史博物館の魅力',
        text: 'お城の近くにあるから、散歩の途中で寄れるのが魅力ね。外観もきれいで写真映えもするわ。',
      },
      {
        id: 'm4',
        subtitle: 'おすすめの人',
        text: '歴史好きはもちろん、のんびり散歩しながら学びたい人にぴったりよ。',
        image: '/images/maps/elements/buildings/KochiCastleMusium2.webp',
      },
      {
        id: 'm5',
        subtitle: 'おばあちゃんからのワンポイント',
        text: '午前中に行くと人が少なくてゆっくり見られるわ。歩きやすい靴で行くのが安心よ。',
      },
    ],
  },
  {
    id: 'otepia',
    title: 'オーテピア（図書館）',
    location: {
      lat: 33.5600875,
      lng: 133.529,
      radiusMeters: 90,
    },
    messages: [
      {
        id: 'o1',
        subtitle: 'オーテピアとは？',
        text: '図書館と文化施設が一体になった、静かに学べる場所よ。落ち着いた空気が心地いいの。',
      },
      {
        id: 'o2',
        subtitle: '何ができる？',
        text: '本を読んだり調べものをしたり、展示やイベントに参加できるわ。ゆっくり過ごせるのがうれしいね。',
      },
      {
        id: 'o3',
        subtitle: 'オーテピアの魅力',
        text: '外がにぎやかでも館内は静かで集中できるところ。居心地のよさが魅力よ。',
      },
      {
        id: 'o4',
        subtitle: 'おすすめの人',
        text: '勉強や調べものをしたい人、静かな時間が好きな人におすすめよ。',
        image: '/images/maps/elements/buildings/Ohtepia.webp',
      },
      {
        id: 'o5',
        subtitle: 'おばあちゃんからのワンポイント',
        text: '疲れたら館内の落ち着いた場所でひと休み。静かな場所ほど長居したくなるのよ。',
      },
    ],
  },
  {
    id: 'kochi-castle',
    title: '高知城',
    location: {
      lat: 33.5673,
      lng: 133.53129,
      radiusMeters: 110,
    },
    messages: [
      {
        id: 'c1',
        subtitle: '高知城とは？',
        text: '土佐を代表するお城で、天守からの景色がとてもきれいなの。歴史を感じられる場所よ。',
      },
      {
        id: 'c2',
        subtitle: '何ができる？',
        text: '城内を歩いて見学できるし、眺めを楽しみながらゆっくり回れるわ。',
      },
      {
        id: 'c3',
        subtitle: '高知城の魅力',
        text: '昔の人の暮らしを想像しながら歩くとワクワクするの。石垣や門も見どころよ。',
      },
      {
        id: 'c4',
        subtitle: 'おすすめの人',
        text: '歴史好きはもちろん、運動しながら景色も楽しみたい人におすすめよ。',
        image: '/images/maps/elements/buildings/KochiCastle.webp',
      },
      {
        id: 'c5',
        subtitle: 'おばあちゃんからのワンポイント',
        text: '晴れた日は写真がとてもきれいに撮れるわ。早めの時間帯が人も少なくておすすめよ。',
      },
    ],
  },
  {
    id: 'tintin-densha',
    title: 'チンチン電車',
    location: {
      lat: 33.55264,
      lng: 133.53093,
      radiusMeters: 100,
    },
    messages: [
      {
        id: 't1',
        subtitle: 'チンチン電車とは？',
        text: '高知の街を走る路面電車よ。のんびりした雰囲気が高知らしいの。',
      },
      {
        id: 't2',
        subtitle: '何ができる？',
        text: '街の景色を眺めながら移動できて、旅気分も味わえるわ。',
      },
      {
        id: 't3',
        subtitle: 'チンチン電車の魅力',
        text: 'ゆっくり走るから、揺れも含めて楽しいの。街の空気がよくわかるわよ。',
      },
      {
        id: 't4',
        subtitle: 'おすすめの人',
        text: '歩き疲れた人や、街の雰囲気を楽しみたい人におすすめよ。',
        image: '/images/maps/elements/buildings/Train.webp',
      },
      {
        id: 't5',
        subtitle: 'おばあちゃんからのワンポイント',
        text: '時間があるならぜひ一度乗ってみて。窓側に座ると景色がよく見えるわ。',
      },
    ],
  },
];
