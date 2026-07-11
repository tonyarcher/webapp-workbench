package com.baseball

// Unified facade matching the previous structure, delegation/mapping to split constants files
object Constants {
    // Navigation Tabs
    const val TAB_WELCOME = BaseballConstants.TAB_WELCOME
    const val TAB_LIVE_SCORER = BaseballConstants.TAB_LIVE_SCORER
    const val TAB_BOXSCORE = BaseballConstants.TAB_BOXSCORE
    const val TAB_LEAGUES = BaseballConstants.TAB_LEAGUES
    const val TAB_TEAMS = BaseballConstants.TAB_TEAMS
    const val TAB_GAMES = BaseballConstants.TAB_GAMES
    const val TAB_LOGIN = BaseballConstants.TAB_LOGIN
    const val TAB_REGISTER = BaseballConstants.TAB_REGISTER

    // Storage Keys
    const val KEY_LOCAL_GAME_STATE = BaseballConstants.KEY_LOCAL_GAME_STATE
    const val KEY_AUTH_TOKEN = BaseballConstants.KEY_AUTH_TOKEN
    const val KEY_ACTIVE_SESSION = BaseballConstants.KEY_ACTIVE_SESSION
    const val KEY_CURRENT_USER_EMAIL = BaseballConstants.KEY_CURRENT_USER_EMAIL
    const val KEY_CURRENT_USER_NAME = BaseballConstants.KEY_CURRENT_USER_NAME
    
    // Navigation Storage Keys
    const val KEY_NAV_IS_SINGLE_GAME_MODE = BaseballConstants.KEY_NAV_IS_SINGLE_GAME_MODE
    const val KEY_NAV_IS_WELCOME_SCREEN = BaseballConstants.KEY_NAV_IS_WELCOME_SCREEN
    const val KEY_NAV_SELECTED_GAME_ID = BaseballConstants.KEY_NAV_SELECTED_GAME_ID
    const val KEY_NAV_SELECTED_LEAGUE_ID = BaseballConstants.KEY_NAV_SELECTED_LEAGUE_ID
    const val KEY_NAV_SELECTED_SEASON_ID = BaseballConstants.KEY_NAV_SELECTED_SEASON_ID
    const val KEY_NAV_SELECTED_TEAM_ID = BaseballConstants.KEY_NAV_SELECTED_TEAM_ID
    const val KEY_NAV_CURRENT_TAB = BaseballConstants.KEY_NAV_CURRENT_TAB
    
    // Default config / values
    const val DEFAULT_FIRST_PITCH_TIME = BaseballConstants.DEFAULT_FIRST_PITCH_TIME
    const val DEFAULT_GAME_DATE = BaseballConstants.DEFAULT_GAME_DATE

    // Play Result Strings
    const val PLAY_RESULT_RUN_SCORED = BaseballConstants.PLAY_RESULT_RUN_SCORED
    const val PLAY_RESULT_OUT = BaseballConstants.PLAY_RESULT_OUT
    const val PLAY_RESULT_LOB = BaseballConstants.PLAY_RESULT_LOB
    const val PLAY_RESULT_1B = BaseballConstants.PLAY_RESULT_1B
    const val PLAY_RESULT_2B = BaseballConstants.PLAY_RESULT_2B
    const val PLAY_RESULT_3B = BaseballConstants.PLAY_RESULT_3B

    // Statistical Metrics
    const val METRIC_AB = BaseballConstants.METRIC_AB
    const val METRIC_R = BaseballConstants.METRIC_R
    const val METRIC_H = BaseballConstants.METRIC_H
    const val METRIC_RBI = BaseballConstants.METRIC_RBI
    const val METRIC_PITCHER = BaseballConstants.METRIC_PITCHER

    // Event Descriptions / Substrings
    const val DESC_DOUBLE_PLAY = BaseballConstants.DESC_DOUBLE_PLAY
    const val DESC_DP = BaseballConstants.DESC_DP

    // Network & Authentication Status
    const val STATUS_CONNECT = BaseballConstants.STATUS_CONNECT
    const val STATUS_REFUSED = BaseballConstants.STATUS_REFUSED
    const val STATUS_NETWORK = BaseballConstants.STATUS_NETWORK
    const val STATUS_400 = BaseballConstants.STATUS_400
    const val STATUS_BAD_REQUEST = BaseballConstants.STATUS_BAD_REQUEST

    // Delegated sub-objects to UiConstants and BaseballConstants
    val Html = UiConstants.Html
    val Css = UiConstants.Css
    val CssValues = UiConstants.CssValues
    val Classes = UiConstants.Classes
    val Positions = BaseballConstants.Positions
}
