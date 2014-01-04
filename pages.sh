jake doc
jake test
mv doc doc-tmp
mv cov cov-tmp
cp -r guide-dev guide-tmp

git checkout gh-pages

if [ $? ]
then
    echo 'Could not check out gh-pages'
    exit 1
fi

rm -r doc cov guide
mv doc-tmp doc
mv cov-tmp cov
mv guide-tmp guide

git add doc cov guide
git commit -a -m "update guide, docs and coverage on `date`"

echo 'Pages updated'
git checkout master
