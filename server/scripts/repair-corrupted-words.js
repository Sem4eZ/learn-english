/**
 * Migration Script: Repair Corrupted Dictionary Words
 * Fixes all words that had grammar exercise explanations or mismatching context sentences
 * in both local SQLite and Turso Cloud database.
 */

const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://fluentiq-db-sem4ez.aws-eu-north-1.turso.io';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTIxNTM1NjYsImlkIjoiMDFhMTQ0YWMtZWMwMS03Y2E3LWJjMTctNDUwMmNmODdkZTU3Iiwia2lkIjoiR0doek1jNFJtNWQ2TlFTRGpHOFpjMnFCUFl1ZUlzY2YxTloyMXprTHJhUSIsInJpZCI6IjE3OTY5YTk5LWU1M2ItNDQyZS05ZDg4LWRiZmJjMjdhZmRlMiJ9.eK7qSriccGMOjUjmj05wsXHJPI-UYlGR1dp5sQE8nzEX4n2qW6SdXMjPsw0-RR9_Cfge6mJUdNdcx36eumbEDw';

const cleanWordData = [
  {
    word: 'technician',
    transcription: '/tekˈnɪʃn/',
    part_of_speech: 'noun',
    translation: 'техник, специалист, мастер',
    definition: 'A person employed to look after technical equipment or do practical work in a laboratory, IT, or engineering field.',
    example_sentence: 'The technician quickly diagnosed the hardware fault and repaired my laptop.',
    example_translation: 'Техник быстро диагностировал аппаратную неисправность и починил мой ноутбук.'
  },
  {
    word: 'safety instructions',
    transcription: '/ˈseɪfti ɪnˈstrʌkʃnz/',
    part_of_speech: 'phrase',
    translation: 'инструкции по технике безопасности',
    definition: 'Official guidelines and safety rules explaining how to avoid danger and handle equipment properly.',
    example_sentence: 'All workers must read the safety instructions carefully before operating any machinery.',
    example_translation: 'Все рабочие должны внимательно прочитать инструкции по технике безопасности перед работой на станках.'
  },
  {
    word: 'ring road',
    transcription: '/ˈrɪŋ rəʊd/',
    part_of_speech: 'noun',
    translation: 'кольцевая автодорога',
    definition: 'A main road that bypasses a city centre or loops around a town to divert through-traffic.',
    example_sentence: 'We took the ring road to bypass the heavy traffic in the city centre.',
    example_translation: 'Мы поехали по кольцевой дороге, чтобы объехать плотное движение в центре города.'
  },
  {
    word: 'extensively',
    transcription: '/ɪkˈstensɪvli/',
    part_of_speech: 'adverb',
    translation: 'широко, основательно, капитально',
    definition: 'To a large degree, in a comprehensive manner, or over a wide area.',
    example_sentence: 'The downtown library was extensively renovated to preserve its historic architecture.',
    example_translation: 'Центральная библиотека была капитально отремонтирована для сохранения ее исторической архитектуры.'
  },
  {
    word: 'submit',
    transcription: '/səbˈmɪt/',
    part_of_speech: 'verb',
    translation: 'сдавать, представлять, отправлять (документы)',
    definition: 'To formally present a proposal, document, or application for others to judge or review.',
    example_sentence: 'Please submit your quarterly financial report before the Friday deadline.',
    example_translation: 'Пожалуйста, отправьте ваш квартальный финансовый отчет до крайнего срока в пятницу.'
  },
  {
    word: 'heavy traffic',
    transcription: '/ˈhevi ˈtræfɪk/',
    part_of_speech: 'phrase',
    translation: 'плотное движение, автомобильные пробки',
    definition: 'A very large volume of vehicles on the road causing slow travel and road congestion.',
    example_sentence: 'I was late for work this morning because of unexpected heavy traffic on the highway.',
    example_translation: 'Я опоздал на работу этим утром из-за неожиданных автомобильных пробок на шоссе.'
  },
  {
    word: 'renovate',
    transcription: '/ˈrenəveɪt/',
    part_of_speech: 'verb',
    translation: 'ремонтировать, обновлять, реконструировать',
    definition: 'To restore an old building or room to a good state of repair through modern improvements.',
    example_sentence: 'The company decided to renovate the historic office building rather than rebuild it.',
    example_translation: 'Компания решила отремонтировать историческое офисное здание, а не сносить и строить заново.'
  },
  {
    word: 'showroom',
    transcription: '/ˈʃəʊruːm/',
    part_of_speech: 'noun',
    translation: 'выставочный зал, шоурум',
    definition: 'A large room used to display goods such as cars, furniture, or electrical appliances for sale.',
    example_sentence: 'Customers can explore all the latest car models in our downtown showroom.',
    example_translation: 'Покупатели могут ознакомиться со всеми новейшими моделями автомобилей в нашем центральном шоуруме.'
  },
  {
    word: 'architect',
    transcription: '/ˈɑːkɪtekt/',
    part_of_speech: 'noun',
    translation: 'архитектор',
    definition: 'A qualified professional who designs buildings and oversees their construction.',
    example_sentence: 'The architect created an innovative and energy-efficient design for the new museum.',
    example_translation: 'Архитектор создал инновационный и энергоэффективный проект для нового музея.'
  },
  {
    word: 'emergency exit',
    transcription: '/ɪˈmɜːdʒənsi ˈeksɪt/',
    part_of_speech: 'noun',
    translation: 'запасной выход, аварийный выход',
    definition: 'A designated door through which people can leave a building or vehicle quickly during a crisis or fire.',
    example_sentence: 'Never place boxes or obstruction in front of the emergency exit doors.',
    example_translation: 'Никогда не ставьте коробки или препятствия перед дверями аварийного выхода.'
  },
  {
    word: 'blockbuster',
    transcription: '/ˈblɒkbʌstə(r)/',
    part_of_speech: 'noun',
    translation: 'блокбастер, кассовый фильм или бестселлер',
    definition: 'A film, book, or show that is extraordinarily successful, popular, and brings in huge revenue.',
    example_sentence: "The studio's latest sci-fi blockbuster broke all box office records on its opening weekend.",
    example_translation: 'Новейший научно-фантастический блокбастер студии побил все кассовые рекорды в первые выходные проката.'
  },
  {
    word: 'yesterday',
    transcription: '/ˈjestədeɪ/',
    part_of_speech: 'adverb',
    translation: 'вчера, вчерашний день',
    definition: 'On the day before today; the day preceding today.',
    example_sentence: 'We finished our team project yesterday afternoon and celebrated with pizza.',
    example_translation: 'Мы закончили наш командный проект вчера днем и отпраздновали это пиццей.'
  },
  {
    word: 'schedule',
    transcription: '/ˈʃedjuːl/',
    part_of_speech: 'noun',
    translation: 'график, расписание; планировать',
    definition: 'A plan that gives a list of events or tasks and the exact times at which each should happen.',
    example_sentence: 'I have a very tight work schedule today, but we can meet for lunch tomorrow.',
    example_translation: 'У меня сегодня очень плотный рабочий график, но мы можем встретиться за обедом завтра.'
  },
  {
    word: 'cloud',
    transcription: '/klaʊd/',
    part_of_speech: 'noun',
    translation: 'облако; облачные технологии (IT)',
    definition: 'A visible mass of condensed water vapor floating in the sky, or a network of remote computing servers.',
    example_sentence: 'Modern tech companies store their application data securely in the cloud.',
    example_translation: 'Современные технологические компании надежно хранят данные своих приложений в облаке.'
  },
  {
    word: 'reserved',
    transcription: '/rɪˈzɜːvd/',
    part_of_speech: 'adjective',
    translation: 'зарезервированный, забронированный',
    definition: 'Kept specially for a particular person or purpose; also describes a quiet, restrained personality.',
    example_sentence: 'This front-row table has already been reserved for our VIP guests.',
    example_translation: 'Этот столик в первом ряду уже забронирован для наших VIP-гостей.'
  },
  {
    word: 'routine',
    transcription: '/ruːˈtiːn/',
    part_of_speech: 'noun',
    translation: 'распорядок, рутина, регулярный режим',
    definition: 'A sequence of actions regularly followed; a standard fixed program of habits.',
    example_sentence: 'A regular morning exercise routine helps boost your focus and energy throughout the day.',
    example_translation: 'Регулярная утренняя зарядка помогает повысить концентрацию и заряд энергии на весь день.'
  },
  {
    word: 'taste',
    transcription: '/teɪst/',
    part_of_speech: 'verb',
    translation: 'пробовать на вкус, вкус',
    definition: 'The sensation of flavor perceived in the mouth, or the action of sampling food and drink.',
    example_sentence: 'You should taste this homemade mushroom soup; it is absolutely delicious.',
    example_translation: 'Тебе стоит попробовать этот домашний грибной суп — он невероятно вкусный.'
  },
  {
    word: 'heat',
    transcription: '/hiːt/',
    part_of_speech: 'noun',
    translation: 'жара, тепло; нагревать',
    definition: 'High temperature, warmth, or energy that is transferred from one body to another.',
    example_sentence: 'Drinking plenty of fresh water helps you stay hydrated during the summer heat.',
    example_translation: 'Обильное питье чистой воды помогает избежать обезвоживания во время летней жары.'
  },
  {
    word: 'conference',
    transcription: '/ˈkɒnfərəns/',
    part_of_speech: 'noun',
    translation: 'конференция, съезд',
    definition: 'A formal meeting in which people gather to discuss a particular academic, professional, or political subject.',
    example_sentence: 'Engineers from all around the world attended the annual software architecture conference.',
    example_translation: 'Инженеры со всего мира посетили ежегодную конференцию по архитектуре программного обеспечения.'
  },
  {
    word: 'free time',
    transcription: '/friː taɪm/',
    part_of_speech: 'noun',
    translation: 'свободное время, досуг',
    definition: 'Time that is free from duties or responsibilities, when one can relax and do hobbies.',
    example_sentence: 'In my free time, I love playing acoustic guitar and reading travel books.',
    example_translation: 'В свободное время я люблю играть на акустической гитаре и читать книги о путешествиях.'
  },
  {
    word: 'bestseller',
    transcription: '/ˌbestˈselər/',
    part_of_speech: 'noun',
    translation: 'бестселлер, популярная книга',
    definition: 'A book or other product that sells in very large numbers due to tremendous public acclaim.',
    example_sentence: 'Her debut fantasy novel became an international bestseller within weeks of release.',
    example_translation: 'Ее дебютный фэнтези-роман стал международным бестселлером спустя всего несколько недель после выхода.'
  },
  {
    word: 'traditional',
    transcription: '/trəˈdɪʃənl/',
    part_of_speech: 'adjective',
    translation: 'традиционный, народный',
    definition: 'Existing in or as part of a tradition; long-established customs or practices.',
    example_sentence: 'We enjoyed a wonderful dinner with traditional dishes cooked from authentic family recipes.',
    example_translation: 'Мы насладились прекрасным ужином с традиционными блюдами, приготовленными по старинным семейным рецептам.'
  },
  {
    word: 'traffic congestion',
    transcription: '/ˈtræfɪk kənˈdʒestʃən/',
    part_of_speech: 'noun',
    translation: 'транспортный затор, автомобильная пробка',
    definition: 'A condition on road networks where traffic slows down significantly due to high demand and bottlenecks.',
    example_sentence: 'The new subway line helped reduce traffic congestion across the metropolitan area.',
    example_translation: 'Новая линия метро помогла снизить автомобильные пробки по всей территории мегаполиса.'
  },
  {
    word: 'historic',
    transcription: '/hɪˈstɒrɪk/',
    part_of_speech: 'adjective',
    translation: 'исторический, имеющий историческое значение',
    definition: 'Famous, momentous, or important in history.',
    example_sentence: 'The city council voted to restore the historic downtown library to its original grandeur.',
    example_translation: 'Городской совет проголосовал за восстановление исторической центральной библиотеки в ее первозданном величии.'
  },
  {
    word: 'quarterly report',
    transcription: '/ˈkwɔːtəli rɪˈpɔːt/',
    part_of_speech: 'noun',
    translation: 'квартальный отчет',
    definition: 'A summary or collection of financial results issued by companies every three months.',
    example_sentence: 'The executive team presented the positive quarterly report to our shareholders.',
    example_translation: 'Команда руководителей представила акционерам позитивный квартальный отчет.'
  },
  {
    word: 'application form',
    transcription: '/ˌæplɪˈkeɪʃn fɔːm/',
    part_of_speech: 'noun',
    translation: 'бланк заявления, анкета',
    definition: 'A printed or digital document with blank spaces in which to provide personal details when applying for a job, course, or visa.',
    example_sentence: 'Please fill out this visa application form in capital letters and sign it.',
    example_translation: 'Пожалуйста, заполните этот бланк заявления на визу печатными буквами и подпишите его.'
  },
  {
    word: 'shift',
    transcription: '/ʃɪft/',
    part_of_speech: 'noun',
    translation: 'рабочая смена; сдвиг, смещение; перемещать',
    definition: 'A period of time worked by a group of workers who start work as another group finishes; or a slight change in position.',
    example_sentence: 'The hospital nurses work a 12-hour night shift three days a week.',
    example_translation: 'Медсестры в больнице работают в 12-часовую ночную смену три дня в неделю.'
  },
  {
    word: 'diverse',
    transcription: '/daɪˈvɜːs/',
    part_of_speech: 'adjective',
    translation: 'разнообразный, отличающийся',
    definition: 'Showing a great deal of variety; very different or made up of distinct elements.',
    example_sentence: 'London is a culturally diverse city with people from all around the world.',
    example_translation: 'Лондон — культурно разнообразный город с людьми со всего мира.'
  },
  {
    word: 'finalize',
    transcription: '/ˈfaɪnəlaɪz/',
    part_of_speech: 'verb',
    translation: 'завершать, дорабатывать окончательно',
    definition: 'To complete the last part of a plan, agreement, contract, or project.',
    example_sentence: 'The executive team met late yesterday to finalize the merger agreement.',
    example_translation: 'Руководство встретилось вчера поздно вечером, чтобы окончательно доработать соглашение о слиянии.'
  },
  {
    word: 'prohibited',
    transcription: '/prəˈhɪbɪtɪd/',
    part_of_speech: 'adjective',
    translation: 'запрещенный, недозволенный',
    definition: 'Formally forbidden by law, regulation, rule, or authority.',
    example_sentence: 'Smoking and vaping are strictly prohibited inside the airport terminal.',
    example_translation: 'Курение и вейпинг строго запрещены внутри терминала аэропорта.'
  },
  {
    word: 'struggle',
    transcription: '/ˈstrʌɡl/',
    part_of_speech: 'verb',
    translation: 'бороться, испытывать трудности',
    definition: 'To try very hard to do something difficult, or make strenuous efforts in the face of obstacles.',
    example_sentence: 'Many small businesses struggle to survive during their very first year.',
    example_translation: 'Многие малые предприятия изо всех сил пытаются выжить в течение самого первого года.'
  },
  {
    word: 'merger',
    transcription: '/ˈmɜːdʒər/',
    part_of_speech: 'noun',
    translation: 'слияние (компаний), объединение',
    definition: 'The combination of two or more commercial companies or organizations into one.',
    example_sentence: 'The merger of the two technology companies created a global industry giant.',
    example_translation: 'Слияние двух технологических компаний создало глобального отраслевого гиганта.'
  },
  {
    word: 'underground station',
    transcription: '/ˈʌndəɡraʊnd ˈsteɪʃn/',
    part_of_speech: 'noun',
    translation: 'станция метро',
    definition: 'A station for an underground railway system (subway or tube).',
    example_sentence: 'Follow the pedestrian signs to reach the nearest underground station.',
    example_translation: 'Следуйте по пешеходным указателям, чтобы дойти до ближайшей станции метро.'
  },
  {
    word: 'Dear',
    transcription: '/dɪər/',
    part_of_speech: 'adjective',
    translation: 'уважаемый, дорогой (в переписке)',
    definition: 'Used as a polite formula for beginning an official or formal letter or email.',
    example_sentence: 'Dear Mr. Davis, thank you for your prompt response to our enquiry.',
    example_translation: 'Уважаемый мистер Дэвис, спасибо за ваш быстрый ответ на наш запрос.'
  },
  {
    word: 'have a meeting',
    transcription: '/hæv ə ˈmiːtɪŋ/',
    part_of_speech: 'phrase',
    translation: 'проводить встречу, встречаться',
    definition: 'To participate in or hold a gathering of people for discussion or business decisions.',
    example_sentence: 'We have a team meeting scheduled for ten o\'clock tomorrow morning.',
    example_translation: 'У нас запланирована командная встреча на десять часов завтрашнего утра.'
  },
  {
    word: 'Can you help me?',
    transcription: '/kæn juː help miː/',
    part_of_speech: 'phrase',
    translation: 'Вы можете мне помочь?',
    definition: 'A polite conventional phrase used to request assistance from someone.',
    example_sentence: 'Excuse me, can you help me find the departure gate for flight 204?',
    example_translation: 'Извините, вы не могли бы помочь мне найти выход на посадку на рейс 204?'
  },
  {
    word: 'Nice to meet you',
    transcription: '/naɪs tuː miːt juː/',
    part_of_speech: 'phrase',
    translation: 'Приятно познакомиться',
    definition: 'A conventional polite greeting used when being introduced to someone for the first time.',
    example_sentence: 'Hello Sarah, nice to meet you, welcome to our head office.',
    example_translation: 'Здравствуйте, Сара, приятно познакомиться, добро пожаловать в наш главный офис.'
  },
  {
    word: 'work for',
    transcription: '/wɜːk fɔːr/',
    part_of_speech: 'verb',
    translation: 'работать на, работать в (компании)',
    definition: 'To be employed by a specific person, company, or institution.',
    example_sentence: 'She works for an international software firm headquartered in Berlin.',
    example_translation: 'Она работает в международной компании по разработке ПО со штаб-квартирой в Берлине.'
  },
  {
    word: 'You are welcome',
    transcription: '/juː ɑːr ˈwelkəm/',
    part_of_speech: 'phrase',
    translation: 'Пожалуйста, не за что',
    definition: 'A polite conventional formula said in reply to someone thanking you.',
    example_sentence: 'Thank you so much for sending the documents so quickly! — You are welcome!',
    example_translation: 'Большое спасибо, что так быстро отправили документы! — Пожалуйста!'
  },
  {
    word: 'in an office',
    transcription: '/ɪn ən ˈɒfɪs/',
    part_of_speech: 'phrase',
    translation: 'в офисе',
    definition: 'Inside a building or room where professional or administrative work is conducted.',
    example_sentence: 'Most of our design and sales employees prefer working in an office.',
    example_translation: 'Большинство наших дизайнеров и специалистов по продажам предпочитают работать в офисе.'
  },
  {
    word: 'business card',
    transcription: '/ˈbɪznəs kɑːd/',
    part_of_speech: 'noun',
    translation: 'визитная карточка, визитка',
    definition: 'A small printed card showing a person\'s name, job title, company, and contact details.',
    example_sentence: 'He handed me his business card after we concluded our discussion.',
    example_translation: 'Он вручил мне свою визитную карточку после того, как мы завершили обсуждение.'
  },
  {
    word: 'speak',
    transcription: '/spiːk/',
    part_of_speech: 'verb',
    translation: 'говорить, разговаривать',
    definition: 'To communicate verbally, utter words, or have conversation in a language.',
    example_sentence: 'Do you speak English or German when discussing client requirements?',
    example_translation: 'Вы говорите по-английски или по-немецки при обсуждении требований клиентов?'
  },
  {
    word: 'sofa',
    transcription: '/ˈsəʊfə/',
    part_of_speech: 'noun',
    translation: 'диван',
    definition: 'A comfortable seat with a back and arms, for two or more people to sit on.',
    example_sentence: 'We bought a comfortable leather sofa for our new living room.',
    example_translation: 'Мы купили удобный кожаный диван в нашу новую гостиную.'
  },
  {
    word: 'shower',
    transcription: '/ˈʃaʊər/',
    part_of_speech: 'noun',
    translation: 'душ, принимать душ',
    definition: 'A cubicle or apparatus in which water is sprayed from above to wash oneself.',
    example_sentence: 'I always take a refreshing warm shower every morning before work.',
    example_translation: 'Я всегда принимаю освежающий теплый душ каждое утро перед работой.'
  },
  {
    word: 'July',
    transcription: '/dʒuˈlaɪ/',
    part_of_speech: 'noun',
    translation: 'июль',
    definition: 'The seventh month of the year, usually one of the warmest months in the Northern Hemisphere.',
    example_sentence: 'Our annual family summer vacation usually begins in the middle of July.',
    example_translation: 'Наш ежегодный семейный летний отпуск обычно начинается в середине июля.'
  },
  {
    word: 'following week',
    transcription: '/ˈfɒləʊɪŋ wiːk/',
    part_of_speech: 'phrase',
    translation: 'следующая неделя',
    definition: 'The week coming immediately after the present or mentioned one.',
    example_sentence: 'The final design review and client presentation will take place the following week.',
    example_translation: 'Финальный обзор дизайна и презентация клиенту состоятся на следующей неделе.'
  },
  {
    word: 'forbidden',
    transcription: '/fəˈbɪdn/',
    part_of_speech: 'adjective',
    translation: 'запрещенный, недопустимый',
    definition: 'Not allowed, prohibited by order, law, rule, or custom.',
    example_sentence: 'Taking flash photos inside the historic museum is strictly forbidden.',
    example_translation: 'Фотографировать со вспышкой внутри исторического музея строго запрещено.'
  },
  {
    word: 'dark clouds',
    transcription: '/dɑːk klaʊdz/',
    part_of_speech: 'noun',
    translation: 'темные тучи, грозовые облака',
    definition: 'Heavy, dark rain-bearing or storm-bearing clouds in the sky.',
    example_sentence: 'Look at those dark clouds gathering over the bay; it is going to rain soon.',
    example_translation: 'Посмотри на эти темные тучи, собирающиеся над заливом: скоро пойдет дождь.'
  }
];

async function repair() {
  console.log('--- 1. Repairing Local SQLite Database ---');
  const localDbPath = path.resolve(__dirname, '../data/english_mastery.db');
  if (fs.existsSync(localDbPath)) {
    const localDb = new DatabaseSync(localDbPath);
    const updateLocal = localDb.prepare(`
      UPDATE dictionary 
      SET translation = ?, definition = ?, example_sentence = ?, example_translation = ?
      WHERE LOWER(word) = LOWER(?)
    `);

    let localCount = 0;
    for (const item of cleanWordData) {
      const res = updateLocal.run(
        item.translation,
        item.definition,
        item.example_sentence,
        item.example_translation,
        item.word
      );
      if (res.changes > 0) {
        localCount += res.changes;
        console.log(`  [Local] Repaired '${item.word}'`);
      }
    }
    console.log(`[Local SQLite] Total words updated: ${localCount}`);
  } else {
    console.log('Local DB not found at:', localDbPath);
  }

  console.log('\n--- 2. Repairing Turso Cloud Database ---');
  try {
    const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    let tursoCount = 0;

    for (const item of cleanWordData) {
      const res = await turso.execute({
        sql: `
          UPDATE dictionary 
          SET translation = ?, definition = ?, example_sentence = ?, example_translation = ?
          WHERE LOWER(word) = LOWER(?)
        `,
        args: [
          item.translation,
          item.definition,
          item.example_sentence,
          item.example_translation,
          item.word
        ]
      });
      if (res.rowsAffected > 0) {
        tursoCount += res.rowsAffected;
        console.log(`  [Turso] Repaired '${item.word}' (${res.rowsAffected} rows)`);
      }
    }
    console.log(`[Turso Cloud libSQL] Total words updated: ${tursoCount}`);
  } catch (err) {
    console.error('Failed to update Turso Cloud:', err.message);
  }

  console.log('\n--- 3. Verifying Remaining Bad Definitions ---');
  try {
    const turso = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    const check = await turso.execute('SELECT id, word, definition FROM dictionary');
    const stillBad = check.rows.filter(r => /правильный ответ|passive voice|conditional|third conditional|past simple/i.test(r.definition || ''));
    console.log(`Remaining corrupted definitions in Turso: ${stillBad.length}`);
    if (stillBad.length > 0) {
      console.log('Still bad:', stillBad);
    }
  } catch (err) {
    console.error('Check failed:', err.message);
  }

  console.log('\nRepair process completed.');
}

repair().catch(console.error);
