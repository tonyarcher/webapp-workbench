

package com.baseball

// Baseball game rules, metrics, network statuses and navigation tabs constants
object BaseballConstants {
    // Navigation Tabs
    const val TAB_WELCOME = "welcome"
    const val TAB_LIVE_SCORER = "live-scorer"
    const val TAB_BOXSCORE = "boxscore"
    const val TAB_LEAGUES = "leagues"
    const val TAB_TEAMS = "teams"
    const val TAB_GAMES = "games"
    const val TAB_STATS = "stats"
    const val TAB_LOGIN = "login"
    const val TAB_REGISTER = "register"

    // Storage Keys
    const val KEY_LOCAL_GAME_STATE = "local_game_state"
    const val KEY_AUTH_TOKEN = "auth_token"
    const val KEY_ACTIVE_SESSION = "active_session"

    // Navigation Storage Keys
    const val KEY_NAV_IS_SINGLE_GAME_MODE = "isSingleGameMode"
    const val KEY_NAV_IS_WELCOME_SCREEN = "isWelcomeScreen"
    const val KEY_NAV_SELECTED_GAME_ID = "selectedGameId"
    const val KEY_NAV_SELECTED_LEAGUE_ID = "selectedLeagueId"
    const val KEY_NAV_SELECTED_SEASON_ID = "selectedSeasonId"
    const val KEY_NAV_SELECTED_TEAM_ID = "selectedTeamId"
    const val KEY_NAV_CURRENT_TAB = "currentTab"

    // Play Result Strings
    const val PLAY_RESULT_RUN_SCORED = "Run Scored"
    const val PLAY_RESULT_OUT = "Out"
    const val PLAY_RESULT_LOB = "LOB"
    const val PLAY_RESULT_1B = "1B"
    const val PLAY_RESULT_2B = "2B"
    const val PLAY_RESULT_3B = "3B"

    // Event Descriptions / Substrings
    const val DESC_DOUBLE_PLAY = "Double Play"
    const val DESC_DP = "DP"

    // Network & Authentication Status
    const val STATUS_CONNECT = "connect"
    const val STATUS_REFUSED = "refused"
    const val STATUS_NETWORK = "network"
    const val STATUS_400 = "400"
    const val STATUS_BAD_REQUEST = "BadRequest"

    // Baseball Positions
    object Positions {
        const val P = "P"
        const val C = "C"
        const val FIRST_BASE = "1B"
        const val SECOND_BASE = "2B"
        const val THIRD_BASE = "3B"
        const val SS = "SS"
        const val LF = "LF"
        const val CF = "CF"
        const val RF = "RF"
        const val DH = "DH"
    }

    // UI dimension constants
    object UiDimensions {
        const val MAX_WIDTH_450 = 450
        const val BORDER_RADIUS_8 = 8
    }
}

