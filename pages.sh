jake doc
jake test
mv doc doc-tmp
mv cov cov-tmp

git checkout gh-pages

rm -r doc cov
mv doc-tmp doc
mv cov-tmp cov

git add doc cov
git commit -a -m "update docs and coverage on `date`"

echo 'Pages updated'
git checkout master
