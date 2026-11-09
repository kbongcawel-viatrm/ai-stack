#!/usr/bin/env bash
bashrc_template=
bashrc_live_config=$HOME/.bashrc

cp $bashrc_template bashrc_live_config
chmod 600 $HOME/.bashrc
source $HOME/.bashrc
