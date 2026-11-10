#!/usr/bin/env bash
bashrc_template=$HOME/Documents/scripts/bashrc.updated
bashrc_live_config=$HOME/.bashrc

cp $bashrc_template bashrc_live_config
chmod 600 $HOME/.bashrc
source $HOME/.bashrc
