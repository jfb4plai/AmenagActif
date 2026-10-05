# Construit la page HTML de consultation de tous les documents des essais (entrées et sorties).
# Usage : python construire_page.py <fichier_sortie.html>
import json, os, sys

BASE = os.path.dirname(os.path.abspath(__file__))
SPEC = os.path.join(BASE, '..', '..', 'superpowers', 'specs', '2026-10-05-export-profil-classe-md-design.md')

GROUPES = [
    ("Spécification", [
        ("Spec v2 de l'export", SPEC, "Conception retenue : synthèse multi-classes, règle des consignes, essais."),
    ]),
    ("Essai 1 : une classe, trois skills enchaînés", [
        ("Export fictif v1", "01a-export-v1-FICTIF.md", "Entrée. Profil d'une classe fictive 3B."),
        ("Export fictif v2 (2 consignes de plus)", "01b-export-v2-FICTIF.md", "Variante avec deux consignes ajoutées à l'en-tête (non retenue)."),
        ("Séance de départ", "02-seance-de-depart.md", "Entrée. Lecture d'un texte informatif sur la ruche."),
        ("Étape 1 : séance différenciée", "03-etape1-seance-differenciee.md", "Sortie de /seance-differenciee."),
        ("Étape 2 : mise en conformité AU", "04-etape2-au-reformatage.md", "Sortie de /au-reformatage."),
        ("Étape 3 : contrôle /verif", "05-etape3-verif.md", "Sortie de /verif : 74 %, à retravailler."),
    ]),
    ("Essai 2 : deux consignes d'en-tête (avec ou sans)", [
        ("Rubrique fixée avant", "ab-test/00-rubrique-fixee-avant.md", "Critères et règle de décision, écrits avant l'essai."),
        ("Sortie x-1 (sans)", "ab-test/x-1.md", ""), ("Sortie x-2 (sans)", "ab-test/x-2.md", ""),
        ("Sortie y-1 (avec)", "ab-test/y-1.md", ""), ("Sortie y-2 (avec)", "ab-test/y-2.md", ""),
    ]),
    ("Essai 3 : règle des consignes (infinitif, un verbe par puce)", [
        ("Résultats", "ab-test-consignes/01-resultats.md", "Comptage et décision : règle conservée."),
        ("Rubrique fixée avant", "ab-test-consignes/00-rubrique-fixee-avant.md", ""),
        ("Sortie p-1 (sans la règle)", "ab-test-consignes/p-1.md", ""), ("Sortie p-2 (sans la règle)", "ab-test-consignes/p-2.md", ""),
        ("Sortie q-1 (avec la règle)", "ab-test-consignes/q-1.md", ""), ("Sortie q-2 (avec la règle)", "ab-test-consignes/q-2.md", ""),
    ]),
    ("Essai 4 : synthèse multi-classes (3 classes fictives)", [
        ("Résultats", "ab-test-multi/01-resultats.md", "Comptage et décision."),
        ("Rubrique fixée avant", "ab-test-multi/00-rubrique-fixee-avant.md", ""),
        ("Entrée A : trois profils séparés", "ab-test-multi/entrees/A-trois-profils-separes.md", "Ce qu'un enseignant obtient aujourd'hui, une classe à la fois."),
        ("Entrée B : synthèse multi-classes", "ab-test-multi/entrees/B-synthese-multi-classes.md", "Le fichier proposé par la spec v2."),
        ("Sortie u-1 (trois profils)", "ab-test-multi/u-1.md", ""), ("Sortie u-2 (trois profils)", "ab-test-multi/u-2.md", ""),
        ("Sortie v-1 (synthèse)", "ab-test-multi/v-1.md", ""), ("Sortie v-2 (synthèse)", "ab-test-multi/v-2.md", ""),
    ]),
    ("Essai 5 : consigne de production (un seul support, variantes minimales)", [
        ("Résultats", "ab-test-production/01-resultats.md", "Nombre de documents 8 → 4,5, niveaux supprimés dans une sortie sur deux."),
        ("Rubrique fixée avant", "ab-test-production/00-rubrique-fixee-avant.md", ""),
        ("Entrée C : trois profils + consigne de production", "ab-test-production/entrees/C-trois-profils-plus-consigne-de-production.md", ""),
        ("Sortie w-1 (avec la consigne)", "ab-test-production/w-1.md", ""), ("Sortie w-2 (avec la consigne)", "ab-test-production/w-2.md", ""),
    ]),
]

docs = []
groupes = []
for titre, items in GROUPES:
    g = {"titre": titre, "items": []}
    for nom, chemin, note in items:
        p = chemin if os.path.isabs(chemin) else os.path.join(BASE, chemin)
        if not os.path.exists(p):
            print('manquant:', p, file=sys.stderr)
            continue
        ident = 'd%d' % len(docs)
        docs.append({"id": ident, "nom": nom, "note": note, "fichier": os.path.relpath(p, os.path.join(BASE, '..', '..', '..')).replace('\\', '/'),
                     "md": open(p, encoding='utf-8').read()})
        g["items"].append(ident)
    groupes.append(g)

gabarit = open(os.path.join(BASE, 'page_gabarit.html'), encoding='utf-8').read()
donnees = json.dumps({"docs": docs, "groupes": groupes}, ensure_ascii=False).replace('</', '<\\/')
html = gabarit.replace('/*__DONNEES__*/', 'const DATA = ' + donnees + ';')
open(sys.argv[1], 'w', encoding='utf-8').write(html)
print(len(docs), 'documents,', round(len(html) / 1024), 'Ko')
