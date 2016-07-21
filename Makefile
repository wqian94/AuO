MAIN_REMOTE := github
MAIN_BRANCH := master
SUBTREE_REMOTE := github
SUBTREE_BRANCH := gh-pages
MIT_REMOTE := mit
MIT_BRANCH := master

all:
	@echo "\033[0;31mReminder: did you make sure to run `jekyll build`?\033[m"
	@echo "\033[0;32mAbout to push commit(s):\033[m"
	@git log --oneline $(MAIN_REMOTE)/$(MAIN_BRANCH)..
	@read -p "Proceed? [Y/n] << " confirm; if [ "$$confirm" != y ] && [ "$$confirm" != Y ]; then echo "\033[1;31mAborting push.\033[m"; exit 1; fi
	@echo "\033[0;32mProceeding.\033[m"
	@echo "\033[1;34mPushing _site subtree to $(SUBTREE_REMOTE)/$(SUBTREE_BRANCH).\033[m"
	@git subtree push --prefix _site $(SUBTREE_REMOTE) $(SUBTREE_BRANCH)
	@echo "\033[1;34mPushing to $(MIT_REMOTE)/$(MIT_BRANCH).\033[m"
	@git push $(MIT_REMOTE) $(MIT_BRANCH)
	@echo "\033[1;34mPushing repository tree to $(MAIN_REMOTE)/$(MAIN_BRANCH).\033[m"
	@git push $(MAIN_REMOTE) $(MAIN_BRANCH)

v%:
	@if git rev-parse -q --verify $@; then git push origin :$@; git push github :$@; fi
	@git tag -af $@ && git push origin $@ && git push github $@

subtree: subtree-master

subtree-%:
	@git push github `git subtree split --prefix _site $*`:gh-pages --force
