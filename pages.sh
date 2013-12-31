jake doc
mv doc doc-tmp
git checkout gh-pages
rm -r doc
mv doc-tmp doc
git add doc
git commit -a -m "update docs on `date`"
echo 'Pages updated'
git checkout master
