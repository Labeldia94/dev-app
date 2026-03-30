/**
 * Script d'import du dictionnaire de base dans Firestore.
 * Lance avec : node scripts/seedDictionnaire.js
 */

require('dotenv').config({ path: '.env' });

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey:            process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const PRODUITS = [
  // Frais
  { nom: 'lait', categorie: '01_Frais' },
  { nom: 'lait demi-écrémé', categorie: '01_Frais' },
  { nom: 'lait entier', categorie: '01_Frais' },
  { nom: 'beurre', categorie: '01_Frais' },
  { nom: 'crème fraîche', categorie: '01_Frais' },
  { nom: 'crème liquide', categorie: '01_Frais' },
  { nom: 'yaourt nature', categorie: '01_Frais' },
  { nom: 'yaourt aux fruits', categorie: '01_Frais' },
  { nom: 'fromage blanc', categorie: '01_Frais' },
  { nom: 'emmental', categorie: '01_Frais' },
  { nom: 'gruyère', categorie: '01_Frais' },
  { nom: 'camembert', categorie: '01_Frais' },
  { nom: 'brie', categorie: '01_Frais' },
  { nom: 'comté', categorie: '01_Frais' },
  { nom: 'mozzarella', categorie: '01_Frais' },
  { nom: 'œufs', categorie: '01_Frais' },
  { nom: 'jus d\'orange frais', categorie: '01_Frais' },
  { nom: 'margarine', categorie: '01_Frais' },

  // Fruits & Légumes
  { nom: 'pommes', categorie: '02_FruitsLegumes' },
  { nom: 'poires', categorie: '02_FruitsLegumes' },
  { nom: 'bananes', categorie: '02_FruitsLegumes' },
  { nom: 'oranges', categorie: '02_FruitsLegumes' },
  { nom: 'citrons', categorie: '02_FruitsLegumes' },
  { nom: 'fraises', categorie: '02_FruitsLegumes' },
  { nom: 'raisins', categorie: '02_FruitsLegumes' },
  { nom: 'mangue', categorie: '02_FruitsLegumes' },
  { nom: 'ananas', categorie: '02_FruitsLegumes' },
  { nom: 'kiwis', categorie: '02_FruitsLegumes' },
  { nom: 'tomates', categorie: '02_FruitsLegumes' },
  { nom: 'carottes', categorie: '02_FruitsLegumes' },
  { nom: 'courgettes', categorie: '02_FruitsLegumes' },
  { nom: 'poivrons', categorie: '02_FruitsLegumes' },
  { nom: 'aubergines', categorie: '02_FruitsLegumes' },
  { nom: 'concombre', categorie: '02_FruitsLegumes' },
  { nom: 'salade', categorie: '02_FruitsLegumes' },
  { nom: 'épinards', categorie: '02_FruitsLegumes' },
  { nom: 'brocoli', categorie: '02_FruitsLegumes' },
  { nom: 'chou-fleur', categorie: '02_FruitsLegumes' },
  { nom: 'poireaux', categorie: '02_FruitsLegumes' },
  { nom: 'oignons', categorie: '02_FruitsLegumes' },
  { nom: 'ail', categorie: '02_FruitsLegumes' },
  { nom: 'pommes de terre', categorie: '02_FruitsLegumes' },
  { nom: 'patates douces', categorie: '02_FruitsLegumes' },
  { nom: 'champignons', categorie: '02_FruitsLegumes' },
  { nom: 'avocats', categorie: '02_FruitsLegumes' },
  { nom: 'haricots verts', categorie: '02_FruitsLegumes' },
  { nom: 'petits pois', categorie: '02_FruitsLegumes' },

  // Boucherie
  { nom: 'poulet entier', categorie: '03_Boucherie' },
  { nom: 'escalopes de poulet', categorie: '03_Boucherie' },
  { nom: 'cuisses de poulet', categorie: '03_Boucherie' },
  { nom: 'steak haché', categorie: '03_Boucherie' },
  { nom: 'côtes de bœuf', categorie: '03_Boucherie' },
  { nom: 'rôti de bœuf', categorie: '03_Boucherie' },
  { nom: 'côtelettes de porc', categorie: '03_Boucherie' },
  { nom: 'lardons', categorie: '03_Boucherie' },
  { nom: 'jambon', categorie: '03_Boucherie' },
  { nom: 'saucisses', categorie: '03_Boucherie' },
  { nom: 'merguez', categorie: '03_Boucherie' },
  { nom: 'chipolatas', categorie: '03_Boucherie' },
  { nom: 'dinde', categorie: '03_Boucherie' },
  { nom: 'filet de saumon', categorie: '03_Boucherie' },
  { nom: 'filet de cabillaud', categorie: '03_Boucherie' },
  { nom: 'crevettes', categorie: '03_Boucherie' },
  { nom: 'thon en boîte', categorie: '03_Boucherie' },

  // Boulangerie
  { nom: 'pain de mie', categorie: '04_Boulangerie' },
  { nom: 'baguette', categorie: '04_Boulangerie' },
  { nom: 'pain complet', categorie: '04_Boulangerie' },
  { nom: 'croissants', categorie: '04_Boulangerie' },
  { nom: 'pains au chocolat', categorie: '04_Boulangerie' },
  { nom: 'brioche', categorie: '04_Boulangerie' },
  { nom: 'biscottes', categorie: '04_Boulangerie' },

  // Épicerie Salée
  { nom: 'pâtes', categorie: '05_EpicerieSalee' },
  { nom: 'spaghettis', categorie: '05_EpicerieSalee' },
  { nom: 'penne', categorie: '05_EpicerieSalee' },
  { nom: 'riz', categorie: '05_EpicerieSalee' },
  { nom: 'riz basmati', categorie: '05_EpicerieSalee' },
  { nom: 'semoule', categorie: '05_EpicerieSalee' },
  { nom: 'quinoa', categorie: '05_EpicerieSalee' },
  { nom: 'lentilles', categorie: '05_EpicerieSalee' },
  { nom: 'pois chiches', categorie: '05_EpicerieSalee' },
  { nom: 'haricots rouges', categorie: '05_EpicerieSalee' },
  { nom: 'tomates en boîte', categorie: '05_EpicerieSalee' },
  { nom: 'sauce tomate', categorie: '05_EpicerieSalee' },
  { nom: 'concentré de tomate', categorie: '05_EpicerieSalee' },
  { nom: 'huile d\'olive', categorie: '05_EpicerieSalee' },
  { nom: 'huile de tournesol', categorie: '05_EpicerieSalee' },
  { nom: 'vinaigre', categorie: '05_EpicerieSalee' },
  { nom: 'moutarde', categorie: '05_EpicerieSalee' },
  { nom: 'mayonnaise', categorie: '05_EpicerieSalee' },
  { nom: 'ketchup', categorie: '05_EpicerieSalee' },
  { nom: 'sel', categorie: '05_EpicerieSalee' },
  { nom: 'poivre', categorie: '05_EpicerieSalee' },
  { nom: 'curry', categorie: '05_EpicerieSalee' },
  { nom: 'paprika', categorie: '05_EpicerieSalee' },
  { nom: 'cumin', categorie: '05_EpicerieSalee' },
  { nom: 'bouillon de poulet', categorie: '05_EpicerieSalee' },
  { nom: 'farine', categorie: '05_EpicerieSalee' },
  { nom: 'chapelure', categorie: '05_EpicerieSalee' },
  { nom: 'chips', categorie: '05_EpicerieSalee' },
  { nom: 'crackers', categorie: '05_EpicerieSalee' },

  // Épicerie Sucrée
  { nom: 'sucre', categorie: '06_EpicerieSucree' },
  { nom: 'sucre glace', categorie: '06_EpicerieSucree' },
  { nom: 'miel', categorie: '06_EpicerieSucree' },
  { nom: 'confiture', categorie: '06_EpicerieSucree' },
  { nom: 'nutella', categorie: '06_EpicerieSucree' },
  { nom: 'pâte à tartiner', categorie: '06_EpicerieSucree' },
  { nom: 'chocolat noir', categorie: '06_EpicerieSucree' },
  { nom: 'chocolat au lait', categorie: '06_EpicerieSucree' },
  { nom: 'céréales', categorie: '06_EpicerieSucree' },
  { nom: 'flocons d\'avoine', categorie: '06_EpicerieSucree' },
  { nom: 'biscuits', categorie: '06_EpicerieSucree' },
  { nom: 'gâteaux', categorie: '06_EpicerieSucree' },
  { nom: 'levure chimique', categorie: '06_EpicerieSucree' },
  { nom: 'cacao en poudre', categorie: '06_EpicerieSucree' },
  { nom: 'compote de pommes', categorie: '06_EpicerieSucree' },

  // Boissons
  { nom: 'eau plate', categorie: '07_Boissons' },
  { nom: 'eau gazeuse', categorie: '07_Boissons' },
  { nom: 'jus d\'orange', categorie: '07_Boissons' },
  { nom: 'jus de pomme', categorie: '07_Boissons' },
  { nom: 'coca-cola', categorie: '07_Boissons' },
  { nom: 'limonade', categorie: '07_Boissons' },
  { nom: 'café', categorie: '07_Boissons' },
  { nom: 'thé', categorie: '07_Boissons' },
  { nom: 'lait végétal', categorie: '07_Boissons' },
  { nom: 'bière', categorie: '07_Boissons' },
  { nom: 'vin rouge', categorie: '07_Boissons' },
  { nom: 'vin blanc', categorie: '07_Boissons' },
  { nom: 'sirop', categorie: '07_Boissons' },

  // Surgelés
  { nom: 'frites surgelées', categorie: '08_Surgeles' },
  { nom: 'pizza surgelée', categorie: '08_Surgeles' },
  { nom: 'légumes surgelés', categorie: '08_Surgeles' },
  { nom: 'épinards surgelés', categorie: '08_Surgeles' },
  { nom: 'petits pois surgelés', categorie: '08_Surgeles' },
  { nom: 'poisson pané surgelé', categorie: '08_Surgeles' },
  { nom: 'glaces', categorie: '08_Surgeles' },
  { nom: 'crèmes glacées', categorie: '08_Surgeles' },

  // Hygiène
  { nom: 'shampoing', categorie: '09_Hygiene' },
  { nom: 'après-shampoing', categorie: '09_Hygiene' },
  { nom: 'gel douche', categorie: '09_Hygiene' },
  { nom: 'savon', categorie: '09_Hygiene' },
  { nom: 'dentifrice', categorie: '09_Hygiene' },
  { nom: 'brosse à dents', categorie: '09_Hygiene' },
  { nom: 'déodorant', categorie: '09_Hygiene' },
  { nom: 'rasoir', categorie: '09_Hygiene' },
  { nom: 'mousse à raser', categorie: '09_Hygiene' },
  { nom: 'coton-tiges', categorie: '09_Hygiene' },
  { nom: 'papier toilette', categorie: '09_Hygiene' },
  { nom: 'mouchoirs', categorie: '09_Hygiene' },
  { nom: 'serviettes hygiéniques', categorie: '09_Hygiene' },

  // Entretien
  { nom: 'liquide vaisselle', categorie: '10_Entretien' },
  { nom: 'lessive', categorie: '10_Entretien' },
  { nom: 'adoucissant', categorie: '10_Entretien' },
  { nom: 'nettoyant multi-surfaces', categorie: '10_Entretien' },
  { nom: 'éponges', categorie: '10_Entretien' },
  { nom: 'sacs poubelle', categorie: '10_Entretien' },
  { nom: 'papier essuie-tout', categorie: '10_Entretien' },
  { nom: 'film plastique', categorie: '10_Entretien' },
  { nom: 'aluminium', categorie: '10_Entretien' },
  { nom: 'tablettes lave-vaisselle', categorie: '10_Entretien' },

  // Bébé
  { nom: 'couches', categorie: '11_Bebe' },
  { nom: 'lingettes bébé', categorie: '11_Bebe' },
  { nom: 'lait infantile', categorie: '11_Bebe' },
  { nom: 'petits pots', categorie: '11_Bebe' },
  { nom: 'compotes bébé', categorie: '11_Bebe' },

  // Animaux
  { nom: 'croquettes chien', categorie: '12_Animaux' },
  { nom: 'croquettes chat', categorie: '12_Animaux' },
  { nom: 'pâtée chat', categorie: '12_Animaux' },
  { nom: 'pâtée chien', categorie: '12_Animaux' },
  { nom: 'litière', categorie: '12_Animaux' },
];

async function seed() {
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  console.log(`Import de ${PRODUITS.length} produits...`);
  let count = 0;

  for (const produit of PRODUITS) {
    const key = produit.nom.trim().toLowerCase();
    await setDoc(doc(db, 'dictionnaire', key), { category: produit.categorie });
    count++;
    process.stdout.write(`\r${count}/${PRODUITS.length}`);
  }

  console.log('\nTerminé !');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
