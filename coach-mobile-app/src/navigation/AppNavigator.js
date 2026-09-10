import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { NavigationContainer, useNavigation, DarkTheme } from '@react-navigation/native';
import { couleurs } from '../theme';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import PagerView from 'react-native-pager-view';

import { useAuth } from '../contexts/AuthContext';
import { messagesAPI } from '../services/api';

// Screens onboarding
import ClientOnboardingScreen from '../screens/onboarding/client/ClientOnboardingScreen';
import CoachOnboardingScreen from '../screens/onboarding/coach/CoachOnboardingScreen';

// Screens client
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SessionDetailScreen from '../screens/SessionDetailScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import CoachSearchScreen from '../screens/CoachSearchScreen';
import CoachDetailScreen from '../screens/CoachDetailScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AppointmentsScreen from '../screens/AppointmentsScreen';

// Screens coach
import CoachDashboardScreen from '../screens/coach/CoachDashboardScreen';
import CoachClientsScreen from '../screens/coach/CoachClientsScreen';
import CoachClientDetailScreen from '../screens/coach/CoachClientDetailScreen';
import CoachSessionFillScreen from '../screens/coach/CoachSessionFillScreen';
import CoachMessagesScreen from '../screens/coach/CoachMessagesScreen';
import CoachProfileScreen from '../screens/coach/CoachProfileScreen';
import EditCoachProfileScreen from '../screens/coach/EditCoachProfileScreen';
import CoachNewProgramScreen from '../screens/coach/CoachNewProgramScreen';
import CoachProgramCalendarScreen from '../screens/coach/CoachProgramCalendarScreen';
import CoachSessionEditorScreen from '../screens/coach/CoachSessionEditorScreen';
import CoachTemplatesScreen from '../screens/coach/CoachTemplatesScreen';

const Stack = createStackNavigator();

// ---------------------------------------------------------------------------
// TABS CLIENT
// ---------------------------------------------------------------------------
const MESSAGES_TAB_INDEX = 1;

const CLIENT_TABS = [
  { key: 'Dashboard',    label: 'Accueil',   icon: 'home',        iconOutline: 'home-outline' },
  { key: 'Messages',     label: 'Messages',  icon: 'chatbubbles', iconOutline: 'chatbubbles-outline' },
  { key: 'Appointments', label: 'Agenda',    icon: 'calendar',    iconOutline: 'calendar-outline' },
  { key: 'Coaches',      label: 'Coachs',    icon: 'search',      iconOutline: 'search-outline' },
  { key: 'Profile',      label: 'Profil',    icon: 'person',      iconOutline: 'person-outline' },
];

const MainTabs = () => {
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigation = useNavigation();
  const messagesResetRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      if (response.data.success) {
        setUnreadCount(response.data.data?.count ?? 0);
      }
    } catch {
      // silencieux
    }
  }, []);

  // Polling toutes les 30 secondes
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Rafraîchir quand l'utilisateur revient sur l'onglet Messages
  useEffect(() => {
    if (currentPage === MESSAGES_TAB_INDEX) {
      fetchUnreadCount();
    }
  }, [currentPage, fetchUnreadCount]);

  const onPageSelected = useCallback((e) => {
    setCurrentPage(e.nativeEvent.position);
  }, []);

  const goToPage = useCallback((index) => {
    pagerRef.current?.setPage(index);
    setCurrentPage(index);
  }, []);

  // Date à appliquer au Dashboard quand on y revient depuis l'Agenda
  const [dashboardTargetDate, setDashboardTargetDate] = useState(null);
  const goToDashboardWithDate = useCallback((dateStr) => {
    setDashboardTargetDate(dateStr);
    pagerRef.current?.setPage(0);
    setCurrentPage(0);
  }, []);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        <View key="dashboard" style={styles.page}>
          <DashboardScreen
            navigation={navigation}
            onGoToProfile={() => goToPage(4)}
            onGoToAppointments={() => goToPage(2)}
            targetDate={dashboardTargetDate}
            onTargetDateConsumed={() => setDashboardTargetDate(null)}
          />
        </View>
        <View key="messages" style={styles.page}>
          <MessagesScreen
            navigation={navigation}
            onConversationRead={fetchUnreadCount}
            isVisible={currentPage === MESSAGES_TAB_INDEX}
            resetRef={messagesResetRef}
          />
        </View>
        <View key="appointments" style={styles.page}>
          <AppointmentsScreen navigation={navigation} onGoToDashboard={goToDashboardWithDate} />
        </View>
        <View key="coaches" style={styles.page}>
          <CoachSearchScreen navigation={navigation} />
        </View>
        <View key="profile" style={styles.page}>
          <ProfileScreen navigation={navigation} onGoToCoaches={() => goToPage(3)} />
        </View>
      </PagerView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {CLIENT_TABS.map((tab, index) => {
          const focused = currentPage === index;
          const showBadge = tab.key === 'Messages' && unreadCount > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                if (focused && tab.key === 'Messages') {
                  messagesResetRef.current?.();
                } else {
                  goToPage(index);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={focused ? tab.icon : tab.iconOutline}
                  size={24}
                  color={focused ? couleurs.accent : couleurs.texteFaible}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// TABS COACH
// ---------------------------------------------------------------------------
const COACH_MESSAGES_TAB_INDEX = 3;

const COACH_TABS = [
  { key: 'Accueil',   label: 'Accueil',   icon: 'home',          iconOutline: 'home-outline' },
  { key: 'Clients',   label: 'Clients',   icon: 'people',        iconOutline: 'people-outline' },
  { key: 'Agenda',    label: 'Agenda',    icon: 'calendar',      iconOutline: 'calendar-outline' },
  { key: 'Messages',  label: 'Messages',  icon: 'chatbubbles',   iconOutline: 'chatbubbles-outline' },
  { key: 'Profil',    label: 'Profil',    icon: 'person',        iconOutline: 'person-outline' },
];

const CoachTabs = () => {
  const pagerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const navigation = useNavigation();
  const messagesResetRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await messagesAPI.getUnreadCount();
      if (response.data.success) {
        setUnreadCount(response.data.data?.count ?? 0);
      }
    } catch {
      // silencieux
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (currentPage === COACH_MESSAGES_TAB_INDEX) {
      fetchUnreadCount();
    }
  }, [currentPage, fetchUnreadCount]);

  const onPageSelected = useCallback((e) => {
    setCurrentPage(e.nativeEvent.position);
  }, []);

  const goToPage = useCallback((index) => {
    pagerRef.current?.setPage(index);
    setCurrentPage(index);
  }, []);

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={0}
        onPageSelected={onPageSelected}
      >
        <View key="accueil" style={styles.page}>
          <CoachDashboardScreen navigation={navigation} onGoToClients={() => goToPage(1)} onGoToProfile={() => goToPage(4)} />
        </View>
        <View key="clients" style={styles.page}>
          <CoachClientsScreen navigation={navigation} />
        </View>
        <View key="agenda" style={styles.page}>
          <AppointmentsScreen navigation={navigation} />
        </View>
        <View key="messages" style={styles.page}>
          <CoachMessagesScreen
            navigation={navigation}
            onConversationRead={fetchUnreadCount}
            isVisible={currentPage === COACH_MESSAGES_TAB_INDEX}
            resetRef={messagesResetRef}
          />
        </View>
        <View key="profil" style={styles.page}>
          <CoachProfileScreen navigation={navigation} />
        </View>
      </PagerView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {COACH_TABS.map((tab, index) => {
          const focused = currentPage === index;
          const showBadge = tab.key === 'Messages' && unreadCount > 0;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => {
                if (focused && tab.key === 'Messages') {
                  messagesResetRef.current?.();
                } else {
                  goToPage(index);
                }
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
            >
              <View style={styles.iconWrapper}>
                <Ionicons
                  name={focused ? tab.icon : tab.iconOutline}
                  size={24}
                  color={focused ? couleurs.accent : couleurs.texteFaible}
                />
                {showBadge && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// NAVIGATOR PRINCIPAL
// ---------------------------------------------------------------------------
/**
 * Thème de la navigation. Il ne colore pas les écrans — ceux-ci portent leurs propres
 * styles — mais le fond visible pendant les transitions, qui reste blanc autrement et
 * provoque un éclair clair à chaque changement d'écran.
 */
const THEME_NAVIGATION = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: couleurs.fond,
    card: couleurs.carte,
    text: couleurs.texte,
    border: couleurs.bord,
    primary: couleurs.accent,
    notification: couleurs.danger,
  },
};

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <NavigationContainer theme={THEME_NAVIGATION}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          /**
           * En-tête natif de React Navigation. Sans ces trois clés il garde son style
           * par défaut — fond blanc, titre sombre — qu'aucun style d'écran ne peut
           * atteindre : il est rendu par la navigation, pas par l'écran.
           */
          headerStyle: { backgroundColor: couleurs.carte },
          headerShadowVisible: false,
          headerTitleStyle: { color: couleurs.texte, fontWeight: '700' },
          // Flèche de retour et libellé : l'accent, comme toute action de l'application.
          headerTintColor: couleurs.accent,
          contentStyle: { backgroundColor: couleurs.fond },
        }}
      >
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ClientOnboarding" component={ClientOnboardingScreen} />
            <Stack.Screen name="CoachOnboarding" component={CoachOnboardingScreen} />
          </>
        ) : (
          <>
            {/* Brancher sur le rôle — onboarding non finalisé en priorité */}
            {user.role === 'COACH' ? (
              <Stack.Screen name="Main" component={CoachTabs} />
            ) : (
              <Stack.Screen name="Main" component={MainTabs} />
            )}
            <Stack.Screen name="ClientOnboarding" component={ClientOnboardingScreen} />
            <Stack.Screen name="CoachOnboarding" component={CoachOnboardingScreen} />

            {/* Screens stack client */}
            <Stack.Screen
              name="SessionDetail"
              component={SessionDetailScreen}
              options={{
                headerShown: true,
                title: 'Détails de la séance',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen
              name="EditProfile"
              component={EditProfileScreen}
              options={{
                headerShown: true,
                title: 'Modifier le profil',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen
              name="CoachDetail"
              component={CoachDetailScreen}
              options={{ headerShown: false }}
            />

            {/* Screens stack coach */}
            <Stack.Screen
              name="CoachClientDetail"
              component={CoachClientDetailScreen}
              options={{
                headerShown: true,
                title: '',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen
              name="CoachSessionFill"
              component={CoachSessionFillScreen}
              options={{
                headerShown: true,
                title: 'Remplir la séance',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen
              name="EditCoachProfile"
              component={EditCoachProfileScreen}
              options={{
                headerShown: true,
                title: 'Modifier le profil',
                headerBackTitle: 'Retour',
              }}
            />
            <Stack.Screen
              name="CoachNewProgram"
              component={CoachNewProgramScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CoachProgramCalendar"
              component={CoachProgramCalendarScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CoachSessionEditor"
              component={CoachSessionEditorScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="CoachTemplates"
              component={CoachTemplatesScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  page: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: couleurs.nav,
    borderTopWidth: 1,
    borderTopColor: couleurs.bord,
    paddingBottom: 28,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: couleurs.danger,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    // Le liseré détache la pastille de l'icône : il doit prendre la couleur de la
    // barre, pas du blanc, sinon il dessine un halo clair sur fond sombre.
    borderColor: couleurs.nav,
  },
  badgeText: {
    color: couleurs.texteInverse,
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  tabLabel: {
    fontSize: 10,
    color: couleurs.texteFaible,
    marginTop: 2,
  },
  tabLabelActive: {
    color: couleurs.accent,
    fontWeight: '600',
  },
});

export default AppNavigator;
