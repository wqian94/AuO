MAIN_REMOTE := origin
MAIN_BRANCH := master
SUBTREE_REMOTE := github
SUBTREE_BRANCH := gh-pages

all:
	@echo "\033[0;32mAbout to push commit(s):\033[m"
	@git log --oneline $(MAIN_REMOTE)/$(MAIN_BRANCH)..
	@read -p "Proceed? [Y/n] << " confirm; if [ "$$confirm" != y ] && [ "$$confirm" != Y ]; then echo "\033[1;31mAborting push.\033[m"; exit 1; fi
	@echo "\033[0;32mProceeding.\033[m"
	@echo "\033[1;34mPushing repository tree to $(MAIN_REMOTE)/$(MAIN_BRANCH).\033[m"
	@git push $(MAIN_REMOTE) $(MAIN_BRANCH)
	@echo "\033[1;34mPushing _site subtree to $(SUBTREE_REMOTE)/$(SUBTREE_BRANCH).\033[m"
	@git subtree push --prefix _site $(SUBTREE_REMOTE) $(SUBTREE_BRANCH)
