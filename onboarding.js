// onboarding.js
export function handleOnboarding(user, message) {
    let responseMessage = "";

    switch (user.state) {
        case "awaiting_language":
            if (message.includes("2")) {
                user.profile.language = "Hindi";
                responseMessage = "आपका स्वागत है! आपका नाम क्या है?";
            } else {
                user.profile.language = "English";
                responseMessage = "Welcome! To get started, what is your name?";
            }
            user.state = "awaiting_name";
            break;

        case "awaiting_name":
            user.profile.name = message;
            user.state = "confirming_name";
            responseMessage = user.profile.language === "Hindi"
                ? `ठीक है, मेरे पास आपका नाम *${message}* है। क्या यह सही है? (हाँ/नहीं)`
                : `Great, I have your name as *${message}*. Is that correct? (Yes/No)`;
            break;

        case "confirming_name":
            const isYes = message.toLowerCase() === 'yes' || message.toLowerCase() === 'हाँ';
            if (isYes) {
                user.state = "awaiting_vehicle";
                responseMessage = user.profile.language === "Hindi"
                    ? `बढ़िया! क्या आप अपने काम के लिए वाहन का उपयोग करते हैं? (उदाहरण: हीरो स्प्लेंडर बाइक, या नहीं)`
                    : `Perfect! Do you use a vehicle for your work? (e.g., Hero Splendor bike, or No)`;
            } else {
                user.state = "awaiting_name";
                responseMessage = user.profile.language === "Hindi"
                    ? `मेरी गलती। मैं आपको क्या बुलाऊँ?`
                    : `My mistake. What should I call you?`;
            }
            break;

        case "awaiting_vehicle":
            if (message.toLowerCase().includes('no') || message.toLowerCase().includes('नहीं')) {
                user.profile.vehicle = "None";
            } else {
                user.profile.vehicle = message;
            }
            user.state = "awaiting_income";
            responseMessage = user.profile.language === "Hindi"
                ? `समझ गया। आपकी हर दिन की औसत आय क्या है? (उदाहरण: 1200)`
                : `Got it. What's your average income per day? (e.g., 1200)`;
            break;

        case "awaiting_income":
            user.profile.financials.income_per_day_avg = parseFloat(message) || 0;
            user.state = "awaiting_balance";
            responseMessage = user.profile.language === "Hindi"
                ? `धन्यवाद! और आपकी अनुमानित वर्तमान बचत या बैलेंस क्या है?`
                : `Thanks! And what's your approximate current savings or balance?`;
            break;

        case "awaiting_balance":
            user.profile.financials.current_balance = parseFloat(message) || 0;
            user.state = "awaiting_health";
            responseMessage = user.profile.language === "Hindi"
                ? `लगभग हो गया! क्या आपकी कोई स्वास्थ्य समस्या है जिसके बारे में मुझे पता होना चाहिए? ('कोई नहीं' लिखें)`
                : `Almost done! Any ongoing health conditions I should know about? (or 'None')`;
            break;
      
        case "awaiting_health":
            if (message.toLowerCase() !== 'none' && message.toLowerCase() !== 'no' && message.toLowerCase() !== 'कोई नहीं') {
                user.profile.health.conditions.push(message);
            }
            user.state = "awaiting_loans";
            responseMessage = user.profile.language === "Hindi"
                ? `धन्यवाद। अंत में, क्या आपका कोई सक्रिय लोन या EMI है? (उदाहरण: 'फोन EMI 2500' या 'नहीं')`
                : `Thank you. Lastly, any active loans or EMIs? (e.g., 'Phone EMI 2500' or 'No')`;
            break;

        case "awaiting_loans":
            if (message.toLowerCase() !== 'no' && message.toLowerCase() !== 'none' && message.toLowerCase() !== 'नहीं') {
                user.profile.financials.loans.push({ name: message, monthly_emi: parseFloat(message.replace(/[^0-9]/g, '')) || 0 });
            }
            user.state = "onboarded";
            responseMessage = user.profile.language === "Hindi"
                ? `बढ़िया, अब आप पूरी तरह तैयार हैं! 🎉 अब आप मुझसे सलाह मांग सकते हैं।`
                : `Perfect, you're all set up! 🎉 You can now ask me for advice or tell me about your earnings and expenses.`;
            break;
    }
    return responseMessage;
}