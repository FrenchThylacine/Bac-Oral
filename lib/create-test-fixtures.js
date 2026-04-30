#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const fixturesDir = path.join(__dirname, 'test-fixtures');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
  console.log(`Created directory: ${fixturesDir}`);
}

// Create test fixtures
const fixtures = [
  {
    filename: 'sample-theatre.json',
    data: {
      id: "theatre-test-001",
      title: "La scène du duel",
      author: "Pierre Corneille",
      work: "Le Cid",
      genre: "theatre",
      sourceText: "Don Rodrigue, es-tu content? Ton père est satisfait de ta conduite, il voit que tu sais laver une injure sur celui qui te l'a faite. Mais enfin tu viens de combattre? Oui, je l'ai fait pour l'amour de vous, pour que vous soyez fier de moi. Mais pourquoi cette tristesse? C'est que j'ai tué celui que j'aimais.",
      sequence: {
        objectStudy: "Théâtre classique français",
        work: {
          title: "Le Cid",
          author: "Pierre Corneille"
        },
        parcours: "Dramaturgie et conflits"
      }
    }
  },
  {
    filename: 'sample-poetry.json',
    data: {
      id: "poetry-test-001",
      title: "Le Voyageur",
      author: "Arthur Rimbaud",
      work: "Illuminations",
      genre: "poesie",
      sourceText: "Je suis l'auteur du monde! Et voyez, je suis descendu de cette montagne, j'ai traversé ces forêts où la route serpente entre les arbres. Partout, la nature déploie sa beauté sauvage. Les ruisseaux chantent, les oiseaux s'envolent vers l'horizon. C'est un hymne à la liberté que la terre entonne pour ceux qui savent écouter.",
      sequence: {
        objectStudy: "Poésie du XIXe siècle",
        work: {
          title: "Illuminations",
          author: "Arthur Rimbaud"
        },
        parcours: "Vision poétique et révolte"
      }
    }
  },
  {
    filename: 'sample-novel.json',
    data: {
      id: "novel-test-001",
      title: "La rencontre",
      author: "Émile Zola",
      work: "L'Assommoir",
      genre: "roman",
      sourceText: "Elle entra dans le restaurant et tous les regards se tournèrent vers elle. Son cœur battait à la fois de joie et de crainte. Pour la première fois, elle voyait cet homme qui avait occupé ses pensées pendant des mois. Il se leva, l'accueillit avec gentillesse. Mais elle sentait bien que quelque chose avait changé entre eux. La vie les avait façonnés différemment. Et pourtant, dans cet instant suspendu, une flamme jaillit entre leurs yeux.",
      sequence: {
        objectStudy: "Roman réaliste français",
        work: {
          title: "L'Assommoir",
          author: "Émile Zola"
        },
        parcours: "Destin et determinisme"
      }
    }
  },
  {
    filename: 'sample-general.json',
    data: {
      id: "general-test-001",
      title: "Le sens du passage",
      author: "Michel de Montaigne",
      work: "Essais",
      genre: "general",
      sourceText: "Que sais-je? Cette question est au cœur de ma réflexion. L'homme ne cesse de se chercher, de se questionner. Il regarde autour de lui et voit mille contradictions. La vérité n'est jamais simple. Elle se cache derrière les apparences et nous force à penser toujours plus profondément. C'est pourquoi la sagesse commence par l'humilité de celui qui reconnaît les limites de son savoir.",
      sequence: {
        objectStudy: "Littérature générale",
        work: {
          title: "Essais",
          author: "Michel de Montaigne"
        },
        parcours: "Réflexion et humanisme"
      }
    }
  }
];

for (const fixture of fixtures) {
  const filepath = path.join(fixturesDir, fixture.filename);
  fs.writeFileSync(filepath, JSON.stringify(fixture.data, null, 2));
  console.log(`Created: ${filepath}`);
}

console.log('All test fixtures created successfully!');
