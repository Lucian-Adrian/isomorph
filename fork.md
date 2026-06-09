# Ensure your fork is added as a remote (let's name it 'fork' to be safe)
git remote add fork https://github.com/aurelian-th/isomorph.git

# Fetch everything to make sure you have the latest history
git fetch origin
git fetch fork

# Switch to the master branch
git checkout master

# ⚠️ DANGER: Hard reset the master branch to the exact safe commit you specified
git reset --hard 23d37d8a1bb5b06d0c19c1733fcfa9eaf56c2cf3

# Force push this freshly reset master to your fork
git push --force fork master

# Create a new local dev branch based on this safe master
git checkout -b dev

# Push the dev branch and establish a tracking link
git push -u fork dev